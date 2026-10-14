import CoreGraphics
import CoreImage
import CoreVideo
import ExpoModulesCore
import Foundation
import ImageIO
import Vision

private let maxDecodeSide = 2048
private let colorSide = 512
private let labelConfidence: Float = 0.3
private let maxLabels = 10
private let staleFileAge: TimeInterval = 60 * 60

nonisolated(unsafe) private let ciContext = CIContext()

final class NoSubjectException: Exception, @unchecked Sendable {
  override var code: String {
    "ERR_NO_SUBJECT"
  }

  override var reason: String {
    "No subject found"
  }
}

final class ProcessException: GenericException<String>, @unchecked Sendable {
  override var code: String {
    "ERR_PROCESS"
  }

  override var reason: String {
    param
  }
}

public class TenuePhotoModule: Module {
  public func definition() -> ModuleDefinition {
    Name("TenuePhoto")

    AsyncFunction("processPhoto") { (uri: String) async throws -> [String: Any] in
      deleteStaleFiles()
      do {
        return try processPhoto(uri: uri)
      } catch let error as Exception {
        throw error
      } catch {
        throw ProcessException(error.localizedDescription)
      }
    }

    AsyncFunction("prepareModels") { () -> String in
      "ready"
    }
  }
}

private func processPhoto(uri: String) throws -> [String: Any] {
  let source = try loadImage(uri: uri)

  let segmentation = VNGenerateForegroundInstanceMaskRequest()
  let handler = VNImageRequestHandler(ciImage: source, options: [:])
  try handler.perform([segmentation])

  guard let observation = segmentation.results?.first, !observation.allInstances.isEmpty else {
    throw NoSubjectException()
  }
  let masked = try observation.generateMaskedImage(
    ofInstances: observation.allInstances,
    from: handler,
    croppedToInstancesExtent: true
  )
  let maskedImage = CIImage(cvPixelBuffer: masked)
  guard let foreground = ciContext.createCGImage(maskedImage, from: maskedImage.extent) else {
    throw ProcessException("Cannot render cutout")
  }

  let fullPixels = try rgbaPixels(of: foreground, width: foreground.width, height: foreground.height)
  guard let box = opaqueBounds(rgba: fullPixels, width: foreground.width, height: foreground.height) else {
    throw NoSubjectException()
  }
  let cropRect = CGRect(x: box.left, y: box.top, width: box.right - box.left, height: box.bottom - box.top)
  guard let cutout = foreground.cropping(to: cropRect) else {
    throw ProcessException("Cannot crop cutout")
  }

  let colorSize = fitSize(width: cutout.width, height: cutout.height, maxSide: colorSide)
  let colorPixels = try rgbaPixels(of: cutout, width: colorSize.width, height: colorSize.height)
  guard let color = dominantColor(rgba: colorPixels) else {
    throw NoSubjectException()
  }

  let labels = classify(handler)

  let file = try writePng(cutout)
  return [
    "cutoutUri": file.absoluteString,
    "width": cutout.width,
    "height": cutout.height,
    "dominantColor": hexColor(color.0, color.1, color.2),
    "labels": labels
  ]
}

private func classify(_ handler: VNImageRequestHandler) -> [String] {
  let classification = VNClassifyImageRequest()
  do {
    try handler.perform([classification])
  } catch {
    return []
  }
  return (classification.results ?? [])
    .filter { $0.confidence >= labelConfidence }
    .sorted { $0.confidence > $1.confidence }
    .prefix(maxLabels)
    .map { $0.identifier.replacingOccurrences(of: "_", with: " ") }
}

private func cacheDirectory() -> URL {
  FileManager.default.temporaryDirectory.appendingPathComponent("tenue-photo", isDirectory: true)
}

private func deleteStaleFiles() {
  let manager = FileManager.default
  guard let files = try? manager.contentsOfDirectory(
    at: cacheDirectory(),
    includingPropertiesForKeys: [.contentModificationDateKey],
    options: []
  ) else {
    return
  }
  let cutoff = Date().addingTimeInterval(-staleFileAge)
  for file in files {
    let modified = try? file.resourceValues(forKeys: [.contentModificationDateKey]).contentModificationDate
    if let modified, modified < cutoff {
      try? manager.removeItem(at: file)
    }
  }
}

private func loadImage(uri: String) throws -> CIImage {
  let url: URL
  if uri.hasPrefix("/") {
    url = URL(fileURLWithPath: uri)
  } else if let parsed = URL(string: uri), parsed.isFileURL {
    url = parsed
  } else {
    throw ProcessException("Unsupported uri \(uri)")
  }
  guard let imageSource = CGImageSourceCreateWithURL(url as CFURL, nil) else {
    throw ProcessException("Cannot open image at \(uri)")
  }
  let options: [CFString: Any] = [
    kCGImageSourceCreateThumbnailFromImageAlways: true,
    kCGImageSourceCreateThumbnailWithTransform: true,
    kCGImageSourceThumbnailMaxPixelSize: maxDecodeSide
  ]
  guard let decoded = CGImageSourceCreateThumbnailAtIndex(imageSource, 0, options as CFDictionary) else {
    throw ProcessException("Cannot decode image at \(uri)")
  }
  return CIImage(cgImage: decoded)
}

private func rgbaPixels(of image: CGImage, width: Int, height: Int) throws -> [UInt8] {
  guard let space = CGColorSpace(name: CGColorSpace.sRGB) else {
    throw ProcessException("sRGB color space unavailable")
  }
  var data = [UInt8](repeating: 0, count: width * height * 4)
  let drawn = data.withUnsafeMutableBytes { buffer -> Bool in
    guard let context = CGContext(
      data: buffer.baseAddress,
      width: width,
      height: height,
      bitsPerComponent: 8,
      bytesPerRow: width * 4,
      space: space,
      bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
    ) else {
      return false
    }
    context.interpolationQuality = .high
    context.draw(image, in: CGRect(x: 0, y: 0, width: width, height: height))
    return true
  }
  if !drawn {
    throw ProcessException("Cannot create bitmap context")
  }
  return data
}

private func writePng(_ image: CGImage) throws -> URL {
  guard let space = CGColorSpace(name: CGColorSpace.sRGB) else {
    throw ProcessException("sRGB color space unavailable")
  }
  let dir = cacheDirectory()
  try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true, attributes: nil)
  let file = dir.appendingPathComponent("\(UUID().uuidString).png")
  guard let data = ciContext.pngRepresentation(of: CIImage(cgImage: image), format: .RGBA8, colorSpace: space, options: [:]) else {
    throw ProcessException("Cannot write PNG")
  }
  try data.write(to: file, options: .atomic)
  return file
}
