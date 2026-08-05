import Foundation
import React
import UIKit

#if canImport(FoundationModels)
import FoundationModels
#if canImport(_FoundationModels_UIKit)
import _FoundationModels_UIKit
#endif
#if canImport(_Vision_FoundationModels)
import _Vision_FoundationModels
#endif
#endif

/// Xcode 27+ SDKs expose multimodal bill APIs via these overlays.
#if canImport(FoundationModels) && canImport(_FoundationModels_UIKit) && canImport(_Vision_FoundationModels)
private let billParseSupportsImageSDK = true
#else
private let billParseSupportsImageSDK = false
#endif

/**
 * On-device receipt understanding via Apple Foundation Models.
 *
 * Ladder:
 * - iOS 27+: multimodal image + Vision OCRTool → structured total/items
 * - iOS 26+: OCR text → structured total/items
 * - Else: JS heuristics on OCR text
 */
@objc(BillParseModule)
class BillParseModule: NSObject {
  @objc static func requiresMainQueueSetup() -> Bool {
    false
  }

  @objc func isAvailable(
    _ resolver: @escaping RCTPromiseResolveBlock,
    rejecter _: @escaping RCTPromiseRejectBlock
  ) {
    #if canImport(FoundationModels)
    if #available(iOS 26.0, *) {
      resolver(Self.modelIsReady())
      return
    }
    #endif
    resolver(false)
  }

  @objc func supportsImageParse(
    _ resolver: @escaping RCTPromiseResolveBlock,
    rejecter _: @escaping RCTPromiseRejectBlock
  ) {
    #if canImport(FoundationModels)
    if billParseSupportsImageSDK, #available(iOS 27.0, *) {
      resolver(Self.modelIsReady())
      return
    }
    #endif
    resolver(false)
  }

  @objc func parseReceiptText(
    _ text: String,
    resolver: @escaping RCTPromiseResolveBlock,
    rejecter: @escaping RCTPromiseRejectBlock
  ) {
    let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmed.isEmpty else {
      resolver(NSNull())
      return
    }

    #if canImport(FoundationModels)
    if #available(iOS 26.0, *) {
      Task {
        do {
          let payload = try await Self.parseTextWithFoundationModels(trimmed)
          resolver(payload ?? NSNull())
        } catch {
          #if DEBUG
          NSLog("[BillParse] text FM failed: %@", error.localizedDescription)
          #endif
          resolver(NSNull())
        }
      }
      return
    }
    #endif

    resolver(NSNull())
  }

  @objc func parseReceiptImage(
    _ uri: String,
    resolver: @escaping RCTPromiseResolveBlock,
    rejecter: @escaping RCTPromiseRejectBlock
  ) {
    #if canImport(FoundationModels)
    if billParseSupportsImageSDK, #available(iOS 27.0, *) {
      Task {
        do {
          let payload = try await Self.parseImageWithFoundationModels(uri)
          resolver(payload ?? NSNull())
        } catch {
          #if DEBUG
          NSLog("[BillParse] image FM failed: %@", error.localizedDescription)
          #endif
          resolver(NSNull())
        }
      }
      return
    }
    #endif

    resolver(NSNull())
  }

  #if canImport(FoundationModels)
  @available(iOS 26.0, *)
  private static func modelIsReady() -> Bool {
    switch SystemLanguageModel.default.availability {
    case .available:
      return true
    default:
      return false
    }
  }

  @available(iOS 26.0, *)
  private static var receiptInstructions: String {
    """
    You extract structured data from bills and receipts — paper store receipts \
    AND digital screenshots (DoorDash, Uber Eats, restaurant apps, etc.).

    SHOP NAME rules:
    - shopName is the merchant / restaurant / store title printed largest near \
      the top of the bill (or the restaurant name on a delivery screenshot).
    - Prefer the brand or business name over address, phone, order number, \
      "Thank you", "Receipt", cashier, or app chrome.
    - Empty string if unknown.

    TOTAL rules:
    - Use the final TOTAL / amount paid / charged amount (what the customer paid).
    - Prefer TOTAL over SUBTOTAL when both appear.
    - Ignore crossed-out / struck-through prices; use the final shown amounts.

    Line-item rules (critical — follow exactly):
    - Include only purchased food/products. Skip delivery fee, service fee, tax, \
      tip, credits, promo discount rows, payment method, dasher/driver names, \
      and UI chrome ("Order Complete", "Add tip", "Rate", etc.).
    - Paper grocery receipts often look like:
        FFL Bread Ezeki 24 oz
        2 @ 7.19 USD
        14.38 BF
      → quantity="2", unitPrice=7.19, lineTotal=14.38.
      Never put the line total into unitPrice.
    - Weight lines: "2.26 lb @ 4.29 USD/lb" → quantity="2.26 lb", unitPrice=4.29, \
      lineTotal=9.70. Keep lb/kg/oz in quantity.
    - Delivery / app screenshots often look like:
        1 × Double Egg Chicken Noodles    $13.99
        1 × Sambar Rice                   $8.49
      → quantity="1", name without the leading "1 ×", unitPrice=lineTotal=13.99 \
        (or 8.49). The × / x count is quantity.
    - unitPrice is the per-unit price when shown after @; otherwise the item price.
    - lineTotal is what that product line costs before cart-level fees/tax/tip.
    - If a product-linked promo/NPWR discount applies, set discount to the positive \
      dollars saved. Do not invent a separate purchased item for fee/credit rows.
    - Clean product names (drop leading SKU/PLU codes and leading "1 ×" / "2 x").
    - If a value is unknown, use 0 for numbers and an empty string for quantity.
    - Prefer exact printed/OCR digits over estimates.
    """
  }

  @available(iOS 26.0, *)
  private static func makeTextSession() -> LanguageModelSession {
    LanguageModelSession {
      receiptInstructions
    }
  }

  #if canImport(_FoundationModels_UIKit) && canImport(_Vision_FoundationModels)
  @available(iOS 27.0, *)
  private static func makeImageSession() -> LanguageModelSession {
    let ocr = OCRTool(
      name: "receipt_ocr",
      description: """
      Read all visible text from the attached bill image (paper receipt or \
      delivery-app screenshot). Preserve every digit, decimal, quantity \
      (including 1 × / 2 x), unit (lb/kg), @ price, item name, and discount \
      line exactly. Call this before answering.
      """
    )
    return LanguageModelSession(tools: [ocr]) {
      receiptInstructions
    }
  }
  #endif

  @available(iOS 26.0, *)
  private static func parseTextWithFoundationModels(_ ocrText: String) async throws -> [String: Any]? {
    guard modelIsReady() else {
      return nil
    }

    let clipped: String
    if ocrText.count > 6_000 {
      clipped = String(ocrText.prefix(6_000))
    } else {
      clipped = ocrText
    }

    let session = makeTextSession()
    let response = try await session.respond(
      generating: BillParseResult.self,
      options: Self.textGenerationOptions
    ) {
      """
      Parse this bill/receipt OCR into shop/restaurant name, total, and purchased line items.
      Support both grocery "@" pricing and delivery-app "1 × Name $price" lines.

      \(clipped)
      """
    }
    return dictionary(from: response.content, source: "foundation_models_text")
  }

  @available(iOS 26.0, *)
  private static var textGenerationOptions: GenerationOptions {
    #if canImport(_FoundationModels_UIKit)
    GenerationOptions(samplingMode: .greedy, temperature: 0.1)
    #else
    GenerationOptions(sampling: .greedy, temperature: 0.1)
    #endif
  }

  #if canImport(_FoundationModels_UIKit) && canImport(_Vision_FoundationModels)
  @available(iOS 27.0, *)
  private static func parseImageWithFoundationModels(_ uri: String) async throws -> [String: Any]? {
    guard modelIsReady() else {
      return nil
    }
    guard let image = loadDownscaledImage(from: uri) else {
      return nil
    }

    let session = makeImageSession()
    // Prefer OCR digits, but allow image-only if the tool cannot run on screenshots.
    let options = GenerationOptions(
      samplingMode: .greedy,
      temperature: 0.1,
      toolCallingMode: .allowed
    )
    let response = try await session.respond(
      generating: BillParseResult.self,
      options: options
    ) {
      """
      This image is a bill: a paper store receipt OR a delivery/restaurant app \
      screenshot (e.g. DoorDash).
      Call receipt_ocr when helpful to read the text exactly.
      Extract the shop/restaurant/store name (largest title near the top), \
      the final TOTAL paid, and each purchased food/product line item
      (name, quantity, unit price, line total, discount if any).
      Skip fees, tax, tip, credits, and UI chrome.
      """
      Attachment(image)
    }
    return dictionary(from: response.content, source: "foundation_models_image")
  }
  #else
  @available(iOS 27.0, *)
  private static func parseImageWithFoundationModels(_: String) async throws -> [String: Any]? {
    nil
  }
  #endif

  @available(iOS 26.0, *)
  private static func dictionary(
    from bill: BillParseResult,
    source: String
  ) -> [String: Any] {
    var items: [[String: Any]] = []
    for item in bill.items.prefix(24) {
      let name = item.name.trimmingCharacters(in: .whitespacesAndNewlines)
      if name.isEmpty {
        continue
      }

      var unitPrice = item.unitPrice
      var lineTotal = item.lineTotal
      let discount = item.discount
      let quantity = item.quantity.trimmingCharacters(in: .whitespacesAndNewlines)

      // Repair common swap: model put line total into unitPrice and doubled it.
      if let qty = leadingQuantity(from: quantity),
        qty > 0,
        unitPrice.isFinite,
        lineTotal.isFinite,
        unitPrice > 0,
        lineTotal > 0
      {
        let product = qty * unitPrice
        if abs(product - lineTotal) <= 0.05, abs(unitPrice - lineTotal) > 0.05 {
          // Consistent but may still be wrong; leave as-is.
        } else if abs(unitPrice - lineTotal) <= 0.05, qty > 1 {
          // unitPrice == lineTotal → likely missing split; derive unit from total.
          unitPrice = (lineTotal / qty * 100).rounded() / 100
        } else if abs(qty * lineTotal - unitPrice) <= 0.05 {
          // Completely swapped fields.
          let swappedUnit = lineTotal
          let swappedTotal = unitPrice
          unitPrice = swappedUnit
          lineTotal = swappedTotal
        }
      }

      items.append([
        "name": name,
        "quantity": quantity,
        "unitPrice": unitPrice,
        "lineTotal": lineTotal,
        "discount": (discount.isFinite && discount > 0) ? discount : 0,
      ])
    }

    let total = bill.total
    let safeTotal: Any =
      (total.isFinite && total >= 0 && total <= 1_000_000) ? total : NSNull()
    let shopName = bill.shopName.trimmingCharacters(in: .whitespacesAndNewlines)

    return [
      "total": safeTotal,
      "shopName": shopName,
      "items": items,
      "source": source,
    ]
  }

  /// Leading numeric quantity from strings like "2", "2.26 lb", "3 ct".
  private static func leadingQuantity(from raw: String) -> Double? {
    let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmed.isEmpty else {
      return nil
    }
    var number = ""
    for ch in trimmed {
      if ch.isNumber || ch == "." {
        number.append(ch)
      } else if number.isEmpty {
        continue
      } else {
        break
      }
    }
    guard let value = Double(number), value > 0, value.isFinite else {
      return nil
    }
    return value
  }

  /// Shrink huge camera photos so multimodal prompts stay within token/latency budget.
  private static func loadDownscaledImage(
    from uri: String,
    maxDimension: CGFloat = 1600
  ) -> UIImage? {
    guard let original = loadUIImage(from: uri) else {
      return nil
    }
    let size = original.size
    let longest = max(size.width, size.height)
    guard longest > maxDimension, longest > 0 else {
      return original
    }
    let scale = maxDimension / longest
    let newSize = CGSize(width: size.width * scale, height: size.height * scale)
    let format = UIGraphicsImageRendererFormat.default()
    format.scale = 1
    let renderer = UIGraphicsImageRenderer(size: newSize, format: format)
    return renderer.image { _ in
      original.draw(in: CGRect(origin: .zero, size: newSize))
    }
  }

  private static func loadUIImage(from uri: String) -> UIImage? {
    if uri.hasPrefix("file://"), let url = URL(string: uri) {
      return UIImage(contentsOfFile: url.path)
    }
    if FileManager.default.fileExists(atPath: uri) {
      return UIImage(contentsOfFile: uri)
    }
    if let url = URL(string: uri), url.isFileURL {
      return UIImage(contentsOfFile: url.path)
    }
    return nil
  }
  #endif
}

#if canImport(FoundationModels)
@available(iOS 26.0, *)
@Generable
struct BillParseResult {
  @Guide(description: "Merchant / restaurant / store title printed largest near the top of the bill. Empty if unknown.")
  var shopName: String

  @Guide(description: "Final TOTAL charged to the customer (what they paid), not subtotal. 0 if unknown.")
  var total: Double

  @Guide(description: "Purchased products only — one entry per product, discount applied via discount field.")
  var items: [BillLineItem]
}

@available(iOS 26.0, *)
@Generable
struct BillLineItem {
  @Guide(description: "Human product name without SKU/PLU codes.")
  var name: String

  @Guide(description: "Quantity or weight text exactly as printed, e.g. 2 or 2.26 lb. Empty if unknown.")
  var quantity: String

  @Guide(description: "Price per unit AFTER the @ sign only (e.g. 7.19 in '2 @ 7.19'). Never the line total. 0 if unknown.")
  var unitPrice: Double

  @Guide(description: "Amount charged for this product line (e.g. 14.38), before cart-level tax/payment. 0 if unknown.")
  var lineTotal: Double

  @Guide(description: "Positive dollars saved by a promo/NPWR/coupon for this product (e.g. 1.80). 0 if none.")
  var discount: Double
}
#endif
