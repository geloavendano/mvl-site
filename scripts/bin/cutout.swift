// Full-resolution person cut-out using Vision's person segmentation.
//
// The background-removal tool used for the 260902 batch capped output at 512px,
// which is well under the card's retina target. Vision runs at the source's own
// resolution and separates enclosed regions — the gap between an arm and the
// torso — which is what the earlier cut-outs left filled in.
//
//   swiftc -O scripts/bin/cutout.swift -o scripts/bin/cutout
//   scripts/bin/cutout <input> <output.png>
import Foundation
import Vision
import CoreImage
import AppKit

let args = CommandLine.arguments
guard args.count == 3 else {
    FileHandle.standardError.write("usage: cutout <input> <output.png>\n".data(using: .utf8)!)
    exit(2)
}
let inURL = URL(fileURLWithPath: args[1])
let outURL = URL(fileURLWithPath: args[2])

// applyOrientationProperty is essential: most of these were shot in landscape
// with an EXIF rotation flag, and reading the raw pixel grid leaves the player
// lying on their side — 18 of 27 on the first pass.
guard let src = CIImage(contentsOf: inURL,
                        options: [.applyOrientationProperty: true]) else {
    FileHandle.standardError.write("cannot read \(args[1])\n".data(using: .utf8)!); exit(1)
}

let request = VNGeneratePersonSegmentationRequest()
request.qualityLevel = .accurate
request.outputPixelFormat = kCVPixelFormatType_OneComponent8

let handler = VNImageRequestHandler(ciImage: src, options: [:])
do { try handler.perform([request]) } catch {
    FileHandle.standardError.write("vision failed: \(error)\n".data(using: .utf8)!); exit(1)
}
guard let buf = request.results?.first?.pixelBuffer else {
    FileHandle.standardError.write("no person found\n".data(using: .utf8)!); exit(3)
}

var mask = CIImage(cvPixelBuffer: buf)
// the mask comes back at Vision's working size; stretch it back over the source
mask = mask.transformed(by: CGAffineTransform(
    scaleX: src.extent.width / mask.extent.width,
    y: src.extent.height / mask.extent.height))

guard let blend = CIFilter(name: "CIBlendWithMask") else { exit(1) }
blend.setValue(src, forKey: kCIInputImageKey)
blend.setValue(CIImage(color: .clear).cropped(to: src.extent), forKey: kCIInputBackgroundImageKey)
blend.setValue(mask, forKey: kCIInputMaskImageKey)
guard let out = blend.outputImage else { exit(1) }

let ctx = CIContext()
guard let data = ctx.pngRepresentation(of: out,
                                       format: .RGBA8,
                                       colorSpace: CGColorSpace(name: CGColorSpace.sRGB)!) else { exit(1) }
try data.write(to: outURL)
print("\(Int(src.extent.width))x\(Int(src.extent.height))")
