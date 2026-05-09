import Foundation
import UIKit

enum BasecampAPIError: LocalizedError {
    case invalidServerURL
    case invalidURL(String)
    case transport(String)
    case server(status: Int, message: String)
    case decoding(String)

    var errorDescription: String? {
        switch self {
        case .invalidServerURL:
            "Enter a valid Basecamp server URL."
        case .invalidURL(let path):
            "Basecamp could not build a URL for \(path)."
        case .transport(let message):
            message
        case .server(_, let message):
            message
        case .decoding(let message):
            message
        }
    }
}

final class BasecampAPI {
    let baseURL: URL
    private let session: URLSession
    private let decoder: JSONDecoder
    private let encoder: JSONEncoder

    init(serverURL: String, session: URLSession = .shared) throws {
        guard let url = URL(string: serverURL.trimmingCharacters(in: .whitespacesAndNewlines)),
              let scheme = url.scheme,
              ["http", "https"].contains(scheme),
              url.host != nil else {
            throw BasecampAPIError.invalidServerURL
        }
        self.baseURL = url
        self.session = session
        self.decoder = JSONDecoder()
        self.decoder.dateDecodingStrategy = .iso8601
        self.encoder = JSONEncoder()
        self.encoder.dateEncodingStrategy = .iso8601
    }

    func absoluteURL(for path: String?) -> URL? {
        guard let path, !path.isEmpty else { return nil }
        if let url = URL(string: path), url.scheme != nil {
            return url
        }
        return URL(string: path, relativeTo: baseURL)?.absoluteURL
    }

    func get<T: Decodable>(_ path: String, query: [URLQueryItem] = []) async throws -> T {
        let request = try makeRequest(path: path, method: "GET", query: query)
        return try await perform(request)
    }

    func post<Response: Decodable, Body: Encodable>(
        _ path: String,
        body: Body
    ) async throws -> Response {
        var request = try makeRequest(path: path, method: "POST")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try encoder.encode(body)
        return try await perform(request)
    }

    func post<Response: Decodable>(_ path: String) async throws -> Response {
        let request = try makeRequest(path: path, method: "POST")
        return try await perform(request)
    }

    func patch<Response: Decodable, Body: Encodable>(
        _ path: String,
        body: Body
    ) async throws -> Response {
        var request = try makeRequest(path: path, method: "PATCH")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try encoder.encode(body)
        return try await perform(request)
    }

    func uploadGallery(images: [PickedImage]) async throws -> GalleryUploadResponse {
        let boundary = "Boundary-\(UUID().uuidString)"
        var request = try makeRequest(path: "/api/uploads/gallery", method: "POST")
        request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")
        request.httpBody = multipartBody(images: images, boundary: boundary)
        return try await perform(request)
    }

    private func makeRequest(
        path: String,
        method: String,
        query: [URLQueryItem] = []
    ) throws -> URLRequest {
        guard let url = URL(string: path, relativeTo: baseURL) else {
            throw BasecampAPIError.invalidURL(path)
        }
        guard var components = URLComponents(url: url.absoluteURL, resolvingAgainstBaseURL: false) else {
            throw BasecampAPIError.invalidURL(path)
        }
        if !query.isEmpty {
            components.queryItems = query
        }
        guard let finalURL = components.url else {
            throw BasecampAPIError.invalidURL(path)
        }

        var request = URLRequest(url: finalURL)
        request.httpMethod = method
        request.timeoutInterval = 30
        request.httpShouldHandleCookies = true
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("BaseCampUtah-iOS/1.0", forHTTPHeaderField: "User-Agent")
        return request
    }

    private func perform<T: Decodable>(_ request: URLRequest) async throws -> T {
        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await session.data(for: request)
        } catch {
            throw BasecampAPIError.transport(error.localizedDescription)
        }
        guard let http = response as? HTTPURLResponse else {
            throw BasecampAPIError.transport("Basecamp returned a non-HTTP response.")
        }
        guard (200..<300).contains(http.statusCode) else {
            throw BasecampAPIError.server(
                status: http.statusCode,
                message: parseErrorMessage(from: data, fallbackStatus: http.statusCode)
            )
        }
        if T.self == EmptyResponse.self {
            return EmptyResponse() as! T
        }
        do {
            return try decoder.decode(T.self, from: data)
        } catch {
            let body = String(data: data, encoding: .utf8) ?? ""
            throw BasecampAPIError.decoding("\(error.localizedDescription) \(body.prefix(160))")
        }
    }

    private func parseErrorMessage(from data: Data, fallbackStatus: Int) -> String {
        guard !data.isEmpty else { return "API request failed with \(fallbackStatus)." }
        if let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
           let error = object["error"] {
            if let message = error as? String {
                return message
            }
            if let details = error as? [String: Any] {
                if let code = details["code"] as? String {
                    return code
                }
                return details.description
            }
        }
        return String(data: data, encoding: .utf8) ?? "API request failed with \(fallbackStatus)."
    }

    private func multipartBody(images: [PickedImage], boundary: String) -> Data {
        var body = Data()
        for image in images {
            body.append("--\(boundary)\r\n")
            body.append("Content-Disposition: form-data; name=\"files\"; filename=\"\(image.filename)\"\r\n")
            body.append("Content-Type: \(image.mimeType)\r\n\r\n")
            body.append(image.data)
            body.append("\r\n")
        }
        body.append("--\(boundary)--\r\n")
        return body
    }
}

struct EmptyResponse: Decodable {
    init() {}
}

struct PickedImage: Identifiable, Hashable {
    var id = UUID()
    var filename: String
    var mimeType: String
    var data: Data
}

private extension Data {
    mutating func append(_ string: String) {
        append(Data(string.utf8))
    }
}
