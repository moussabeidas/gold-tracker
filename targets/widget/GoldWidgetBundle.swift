import WidgetKit
import SwiftUI

@main
struct GoldWidgetBundle: WidgetBundle {
  var body: some Widget {
    GoldPriceWidget()
    PortfolioWidget()
  }
}
