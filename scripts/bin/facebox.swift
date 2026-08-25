// Prints the largest detected face as a normalised rect, origin top-left:
//   {"found":true,"x":0.41,"y":0.08,"w":0.11,"h":0.09}
// Vision ships with macOS, so the photo pipeline needs no third-party model.
import Foundation
import Vision
import AppKit

guard CommandLine.arguments.count > 1,
      let img = NSImage(contentsOfFile: CommandLine.arguments[1]),
      let cg = img.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
    print("{\"found\":false}"); exit(0)
}

let req = VNDetectFaceRectanglesRequest()
try? VNImageRequestHandler(cgImage: cg, options: [:]).perform([req])

guard let faces = req.results, !faces.isEmpty else { print("{\"found\":false}"); exit(0) }
// biggest face wins: team photos occasionally catch a bystander in frame
let f = faces.max(by: { $0.boundingBox.width * $0.boundingBox.height
                      < $1.boundingBox.width * $1.boundingBox.height })!
let b = f.boundingBox   // Vision: normalised, origin bottom-left
print(String(format: "{\"found\":true,\"x\":%.4f,\"y\":%.4f,\"w\":%.4f,\"h\":%.4f}",
             b.minX, 1.0 - b.maxY, b.width, b.height))
