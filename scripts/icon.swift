import AppKit
let size:CGFloat = 1024
let image=NSImage(size:NSSize(width:size,height:size))
image.lockFocus()
NSColor(calibratedRed:0.94,green:0.94,blue:0.91,alpha:1).setFill()
NSBezierPath(roundedRect:NSRect(x:70,y:70,width:884,height:884),xRadius:194,yRadius:194).fill()
let font=NSFont(name:"Georgia-BoldItalic",size:650) ?? NSFont.systemFont(ofSize:650)
let text:NSString="w"
text.draw(at:NSPoint(x:219,y:205),withAttributes:[.font:font,.foregroundColor:NSColor(calibratedRed:0.21,green:0.24,blue:0.20,alpha:1)])
NSColor(calibratedRed:0.52,green:0.59,blue:0.46,alpha:1).setFill()
NSBezierPath(ovalIn:NSRect(x:725,y:275,width:85,height:85)).fill()
image.unlockFocus()
let bitmap=NSBitmapImageRep(data:image.tiffRepresentation!)!
try bitmap.representation(using:.png,properties:[:])!.write(to:URL(fileURLWithPath:"assets/icon.png"))
