
ℹ️ You can check the Advanced Charts version by executing `TradingView.version()` in a browser console.

<!-- markdownlint-disable no-emphasis-as-heading -->
<!-- markdownlint-disable no-inline-html -->
<!-- markdownlint-disable code-block-style -->
## Version 31.0.0

*Date: Thu Mar 05 2026*

**New Features**

- **Added table view for data visualization.** Users can now view chart and indicator data in a table format.
This mode can be opened via the legend's "More" menu or the chart context menu.
- **Added multiple exit levels (brackets) support.** When the [`supportMultipleExitLevels`](https:/www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.BrokerConfigFlags#supportmultipleexitlevels) configuration flag is enabled,
users can protect orders and positions with multiple take-profit and stop-loss levels at different prices and quantities.
This feature introduces the `exitLevels` property to order-related interfaces and the `exitLevelId` property to `BracketOrder` for managing these individual levels.
See [Multiple exit levels](https:/www.tradingview.com/charting-library-docs/latest/trading_terminal/trading-concepts/brackets#multiple-exit-levels) for more information. (Trading Platform only)
- **Added support for the Crypto Exchange Order Ticket for specific symbols.** Use new [`supportCryptoExchange`](https:/www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.SymbolSpecificTradingOptions#supportcryptoexchange) property in [`SymbolSpecificTradingOptions`](https:/www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.SymbolSpecificTradingOptions) to control this behavior.
Note that the crypto-specific ticket is displayed only if the [`supportCryptoExchangeOrderTicket`](https:/www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.BrokerConfigFlags#supportcryptoexchangeorderticket) flag is enabled and the symbol's [type](https:/www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.InstrumentInfo#type) is `crypto`. (Trading Platform only)
- **Added symbol logo support in trading dialogs.** Symbol logos can now be displayed in the *Cancel order* and *Close position* dialogs.
To enable them, use the [`show_symbol_logo_in_cancel_order_dialog`](https:/www.tradingview.com/charting-library-docs/latest/customization/Featuresets#show_symbol_logo_in_cancel_order_dialog) and [`show_symbol_logo_in_close_position_dialog`](https:/www.tradingview.com/charting-library-docs/latest/customization/Featuresets#show_symbol_logo_in_close_position_dialog) featuresets alongside the global [`show_symbol_logos`](https:/www.tradingview.com/charting-library-docs/latest/customization/Featuresets#show_symbol_logos) featureset. (Trading Platform only)

**Improvements**

- **Redesigned empty state styling on the main chart.** Updated the icons and text for all empty states (including invalid symbols and no data) to match the latest design.
The empty state container now has a transparent background and full pane coverage.
This provides improved responsive behavior across multi-chart layouts and the Table view.
- **Added the `supportAdaptiveLayout` broker configuration flag.** When [`supportAdaptiveLayout`](https:/www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.TradedGroupConfig#supportadaptivelayout) is `true` (default), trading buttons (TP/SL, P&L) on position and order lines will hide on smaller screens and appear on larger ones.
When `false`, these buttons will always be visible, regardless of screen width. (Trading Platform only)
- **Improved trading settings logic.** The *Reverse position button* option is now automatically disabled in the *Trading settings* whenever *Positions and orders* is unchecked. (Trading Platform only)
- **Quantity input types no longer reset when editing orders on the chart.** The Order Ticket now keeps your selected quantity input type (USD, % balance, Risk) even when you adjust order prices or quantities directly on the chart. (Trading Platform only)
- **Improved "No overlap" mode behavior.** The "No overlap" mode setting in the context menu is now persistent, meaning the separation of orders and positions remains active until manually toggled off. (Trading Platform only)

**Bug Fixes**

- **Fixed a bug where symbols with no trading sessions for an entire week due to holidays could not request data.**

- **Fixed the profit and loss calculation for the risk/reward drawing.** The calculation now correctly uses the actual `qty` based on `lotSize` and multiplies by `pointValue`.
Previously, profit and loss was calculated as if `lotSize = 1`, which produced incorrect values when changing lot size.
- **Fixed quantity rounding for symbols with integer quantities in the Order Ticket.** The quantity calculator now rounds down to `0` if the specified risk or order value is less than the cost of a single unit.
This ensures that validation fails and prevents users from placing an order for `1` unit when the entered value is insufficient to cover the minimum trade value. (Trading Platform only)
- **Fixed an issue where the bracket cancellation dialog would fail to appear.** Previously, when attempting to cancel a bracket order repeatedly, the confirmation dialog might not show up, which prevented the bracket order from actually being cancelled. (Trading Platform only)

**Documentation**

- **New events and subscriptions guide.** Added an article detailing the library's [event system](https:/www.tradingview.com/charting-library-docs/latest/configuration/events-and-subscriptions).
It explains the distinction between widget, chart, and component events.
- **New trading overrides convention guide.** Added a section explaining the [hierarchical naming pattern](https:/www.tradingview.com/charting-library-docs/latest/customization/overrides/trading-overrides#override-properties) for `BrokerOrderOverrides` and `BrokerPositionOverrides`.
It helps identify the specific properties needed to customize the visual state of trading elements.
- **Reorganized the documentation for faster onboarding.** We have streamlined our documentation structure to help you get up and running more quickly.
The [Introduction](https:/www.tradingview.com/charting-library-docs/latest/introduction) and [Get started](https:/www.tradingview.com/charting-library-docs/latest/quick-start) articles are now more focused, and advanced topics have been moved to dedicated functional categories like *Configuration* and *Reference*.
- **Other updates.** The following enhancements were made:
  - Added instructions for [enabling enhanced screen reader descriptions](https:/www.tradingview.com/charting-library-docs/latest/configuration/accessibility#enhanced-descriptions) using the `aria_crosshair_price_description` and `aria_detailed_chart_descriptions` featuresets. They allow screen readers to announce crosshair prices and provide detailed descriptions when the active chart changes.
  - Clarified descriptions for `supportEditAmount`, `supportModifyBrackets`, and `supportModifyOrderPrice` in the [`BrokerConfigFlags`](https:/www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.BrokerConfigFlags) interface.

---

## Version 30.3.0

*Date: Wed Jan 21 2026*

**New Features**

- **Added the `legend_bar_change_colors_based_on_value` featureset.** When enabled, bar change values in the legend are colored based on their value (positive, negative, or zero). Applies only to non-OHLC chart types.
- **Added the `applyOverrides` method to the `IChartWidgetApi` interface.** Unlike [`IChartingLibraryWidget.applyOverrides`](https:/www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.IChartingLibraryWidget#applyoverrides), which applies overrides to **all charts**, this new method allows applying overrides to **specific chart instances**.
Refer to [Apply overrides](https:/www.tradingview.com/charting-library-docs/latest/ui_elements/Chart#apply-overrides) for usage example.

**Bug Fixes**

- **Fixed an issue where orders and positions were no longer displayed after a network reconnection.**  (Trading Platform only)

---

## Version 30.2.0

*Date: Mon Dec 22 2025*

**New Features**

- **Added support for paginated Symbol Search results.** Added the optional [`searchSymbolsPaginated`](https:/www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.IDatafeedChartApi#searchsymbolspaginated) method to the Datafeed API. When implemented, the library uses this method instead of [`searchSymbols`](https:/www.tradingview.com/charting-library-docs/latest/connecting_data/datafeed-api/required-methods#searchsymbols), loading Symbol Search results in "pages" rather than returning all results at once. For example, the first 50 results can be returned initially, and then more can be loaded on demand as the user scrolls down the list of symbols.
- **Added the `--tv-color-bar-mark-background-color` CSS variable.** This variable allows you to set a custom background color for tooltips shown for [bar marks](https:/www.tradingview.com/charting-library-docs/latest/ui_elements/Marks#marks-on-the-chart).
For more information on adjusting UI elements using CSS variables, see [CSS Color Themes](https:/www.tradingview.com/charting-library-docs/latest/customization/styles/CSS-Color-Themes).
- **Supported updating Overlay indicator bars that have a time value less than the two most recent main series times.** Ensured that real-time bars are plotted when an Overlay is "behind" the main series, specifically when the most recent Overlay bar time is less than `mainSeriesBars[mainSeriesBars.length - 2]`.
- **Reenable the Depth of Market (DOM) widget's dynamic mode by default.** The [DOM widget](https:/www.tradingview.com/charting-library-docs/latest/trading_terminal/depth-of-market) was made static starting with version 28. This change has been reversed so that the pre-28 dynamic mode is enabled by default. The static mode added in version 28 is still available by enabling the `static_dom` featureset. (Trading Platform only)

**Improvements**

- **VWAP indicator loads the exact amount of data to reach the target anchor.** Instead of showing an error when there isn’t enough data to calculate the VWAP, the indicator now loads the exact amount of data required to reach the target anchor.
- **Added `isAlwaysShownInLegend` property to input definitions in metainfo.** When set, this property keeps any [indicator inputs](https:/www.tradingview.com/charting-library-docs/latest/custom_studies/metainfo/Custom-Studies-Inputs) (`StudySymbolInputInfo`) visible in the legend, even when other indicator inputs are hidden. Note that the [`always_show_study_symbol_input_values_in_legend`](https:/www.tradingview.com/charting-library-docs/latest/customization/Featuresets/#always_show_study_symbol_input_values_in_legend) featureset must be enabled for this property to take effect.

**Bug Fixes**

- **Fixed an issue where the floating toolbar three dots menu would not call the context menu APIs.**
- **Fixed inaccurate rounding in the Hull indicator calculation.**
- **Fixed an issue where the `onTick` event would not fire.**
- **Fixed an issue where custom indicators that return null values were failing to plot.**
- **Fixed an issue where the `getVisibleBarsRange` method returned the wrong user time.**
- **Fixed an issue where the Overlay indicator was failing to plot because of duplicate bar times.**

**Documentation**

- **New drag-to-export guide.** Check out a guide on how to [enable the drag-to-export feature](https:/www.tradingview.com/charting-library-docs/latest/ui_elements/Chart#enable-drag-to-export-feature), including an interactive example.
It explains how users can drag the chart area to export data to external applications, such as pasting JSON into a text editor.
- **New troubleshooting section.** Added a section that explains possible causes and solutions for when [individual positions are not displayed on the chart](https:/www.tradingview.com/charting-library-docs/latest/trading_terminal/common-issues#individual-positions-are-not-displayed-on-the-chart).

---

## Version 30.1.0

*Date: Mon Nov 10 2025*

**New Features**

- **Added the `always_show_study_symbol_input_values_in_legend` featureset.** When enabled, this featureset keeps symbol-type [indicator inputs](https:/www.tradingview.com/charting-library-docs/latest/custom_studies/metainfo/Custom-Studies-Inputs) (`StudySymbolInputInfo`) visible in the legend, even when other indicator inputs are hidden. This allows users to visually distinguish multiple instances of the same indicator on the chart by their source symbol.

**Improvements**

- **Improved drag-to-export feature.** When the [`chart_drag_export`](https:/www.tradingview.com/charting-library-docs/latest/customization/Featuresets#chart_drag_export) featureset is enabled and [`setDragExportEnabled(true)`](https:/www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.IChartWidgetApi#setdragexportenabled) is called, the chart remains responsive to mouse interactions instead of blocking them. The library now emits [`dragstart`](https:/www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.SubscribeEventsMap#dragstart) for all drags. To treat a drag as a drag-drop export, set payload via the parameters of the [`setData`](https:/www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.DragStartParams#setdata) method. The [event parameters](https:/www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.DragStartParams) also include current modifier keys (ctrl/meta/alt/shift), enabling patterns like Cmd+Drag without relying on global key listeners.
- **Added the `getVisibleBarsRange` method.** [`getVisibleBarsRange`](https:/www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.IChartWidgetApi#getvisiblebarsrange) returns the range of bar times currently shown on the chart. The method includes existing bars and visible incomplete bars produced by non-time-based chart styles (for example, Renko). Unlike [`getVisibleRange`](https:/www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.IChartWidgetApi#getvisiblerange), `getVisibleBarsRange` doesn't include future bar times beyond the last visible bar.
- **Added a dropdown to change the type of Moving Average used for calculating Bollinger Bands.**

- **Support setting `noData` with non-empty bars response.** It is now possible to signal that there is no more data available, while at the same time returning bars via the [`getBars`](https:/www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.IDatafeedChartApi#getbars) callback. Previously, this would cause a `"noData should be set when there is no data in the requested period and earlier only"` warning to be logged to the console, and a second call would be made to [`getBars`](https:/www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.IDatafeedChartApi#getbars).

**Bug Fixes**

- **Fixed an issue where the widget bar would disappear when resizing.** When transitioning to higher dimensions, the widget bar would not necessarily be properly displayed.
- **Fixed VWAP issue.** The VWAP indicator used to break the chart when applied to a Japanese style chart.
- **Fixed an issue where the main series wouldn’t load more data if an indicator error appeared.**
- **Fixed an issue where the Moving Average Double indicator ignored the `Method` input.**
- **Fixed an issue where an error could be thrown after a pane is removed.**
- **Fixed an issue where creating an anchored shape would fail if placed before the first available bar.**
- **Fixed an issue where the Bollinger Bands indicator could be loaded inconsistently.** The result differed depending on whether it was added from the header dropdown or via the `createStudy` method.
- **Fixed an issue where `showOrderDialog` would use the default implementation instead of the one from `customUI`.**  (Trading Platform only)
- **Fixed an issue where interacting with the DOM could cause errors in the console.**  (Trading Platform only)
- **Fixed an issue where the Order Panel would not be shown on screens less than 493 pixels high.** (Trading Platform only)

**Documentation**

- **Updated navigation and structure.** Restructured and expanded documentation for better navigation and clarity:
  - Created a new [Time and sessions](https://www.tradingview.com/charting-library-docs/latest/connecting_data/time-and-sessions/) section with an introductory article explaining how to correctly configure bar times, symbol sessions, and resolutions in the datafeed.
  - Reorganized the [Tutorials](https://www.tradingview.com/charting-library-docs/latest/tutorials/) section into four dedicated categories: Tutorials, How-to guides, Framework integrations, and Interactive code examples.
- **Added new troubleshooting sections.** Each section explains possible causes and solutions for the corresponding issue.
  - [Incorrect time display in Japanese-style charts](https://www.tradingview.com/charting-library-docs/latest/connecting_data/Datafeed-Issues#japanese-charts-show-incorrect-time)
  - [Memory leak investigation steps](https://www.tradingview.com/charting-library-docs/latest/troubleshooting/#memory-leaks)
  - [P&L showing 0 in bracket orders](https://www.tradingview.com/charting-library-docs/latest/trading_terminal/common-issues#pl-in-bracket-orders-shows-0)
- **Other updates.** The following enhancements were made:
  - Added an [interactive example](https://www.tradingview.com/charting-library-docs/latest/ui_elements/Marks#example) showing how to implement marks on the chart or time scale.
  - Expanded explanation and added an example for [enabling custom resolutions](https://www.tradingview.com/charting-library-docs/latest/ui_elements/Resolution#enable-custom-resolutions).
  - Exposed the `addPlusButton` [action ID](https://www.tradingview.com/charting-library-docs/latest/ui_elements/Chart#execute-action-by-id) that enables or disables the *Plus* button on the price scale for [quick trading](https://www.tradingview.com/charting-library-docs/latest/ui_elements/Price-Scale#quick-trading).
  - Clarified the behavior of the [`show_zoom_and_move_buttons_on_touch`](https://www.tradingview.com/charting-library-docs/latest/customization/Featuresets#show_zoom_and_move_buttons_on_touch) featureset on mobile devices.
  - Documented a limitation for `long_positions` and `short_positions` drawing types where the [`text`](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.CreateShapeOptions#text) property is auto-generated and must not be set manually.
  - Clarified method descriptions for `mergeUp`, `mergeDown`, `unmergeUp`, and `unmergeDown` in both [`IStudyApi`](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.IStudyApi/) and [`ISeriesApi`](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.ISeriesApi/) interfaces.
  - Updated the [Connecting data](https://www.tradingview.com/charting-library-docs/latest/connecting_data/) article with clearer descriptions of available integration approaches and their appropriate use cases.

---

## Version 30.0.0

*Date: Mon Sep 18 2025*

**Breaking Changes**

- **Scrolling and resizing cannot be canceled anymore.** Chart scrolling or resizing via the time or price scale no longer triggers a change event. Therefore, these actions cannot be canceled with undo action anymore.
- **Update line tools overrides.** The text visibility checkbox has been removed from the drawing settings. Now, the text is always displayed when specified.
For this reason, the `showLabel` override property has no effect for the line tools such as Trend Line.
- **Update UDF properties.** Both `exchange-listed` and `exchange-traded` have been marked deprecated in favour of a single `exchange_listed_name` property.
From version 31 they will be removed.
- **Extend featureset to display inactivity gaps on DWM charts.** The new [`inactivity_gaps`](https://www.tradingview.com/charting-library-docs/latest/customization/Featuresets#inactivity_gaps) featureset replaces the existing `intraday_inactivity_gaps` and enables the display of inactivity gaps both on intraday and DWM (daily, weekly, monthly) charts. For more information, refer to the [Show/hide gaps on the chart](https://www.tradingview.com/charting-library-docs/latest/ui_elements/Chart#showhide-gaps-on-the-chart) section.
- **Removed support for iOS version below 15.** Only iOS versions including and above 16 are now compatible with the library.
- **Default value of `supportOrdersHistory` changed to `true`.** This means the *History* page in the [Account Manager](https://www.tradingview.com/charting-library-docs/latest/trading_terminal/account-manager/) is enabled by default and requires the [`ordersHistory`](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.IBrokerTerminal#ordershistory) method to be implemented. If you don't plan to support order history, set [`supportOrdersHistory`](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.BrokerConfigFlags#supportordershistory) to `false` in your broker configuration. This hides the *History* page and prevents related errors. (Trading Platform only)

**New Features**

- **Added the "Day of week labels" checkbox to the "Scales and lines" settings dialog.**
- **Added a floating tooltip for detailed bar analysis in the *Cursors* menu.** On a long press on the chart, the tooltip appears and displays the OHLCV values and price change for the selected bar.
It then follows the cursor or finger as you move, providing a seamless way to inspect data across the chart.
To disable this feature, use the `long_press_floating_tooltip` featureset.
- **Added "No overlap mode" toggle for orders and positions.** A new option is now available in the context menu of orders and positions on the chart. When enabled, it prevents trading lines and labels at the same price level from stacking, automatically offsetting them vertically for better readability.

**Improvements**

- **Added option to remove locked drawings.** A new toggle *Always remove locked drawings* is now available in the left toolbar’s delete menu.
When enabled, this option forces the deletion of locked drawings along with other items.
- **Added subscription for *Zoom out* tool.** [`IChartWidgetApi`](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.IChartWidgetApi) has a new property `canZoomOutWV`. It returns whether the chart can be zoomed out using [`zoomOut`](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.IChartWidgetApi#zoomout).
- **The `onSymbolChanged` method returns the right type.** [`onSymbolChanged`](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.IChartWidgetApi#onsymbolchanged) now returns the expected type.
- **Deprecated support for letters in shortcuts.** The support for letters in [shortcuts](https://www.tradingview.com/charting-library-docs/latest/configuration/Shortcuts) has been deprecated. Starting from version 31, string key names are no longer supported.
Old styles like `'ctrl+shift+/'` or `['ctrl', 'shift', '/']` are deprecated. Use the supportable style like `['ctrl', 'shift', 191]` instead. For more information, refer to the [Manage shortcuts](https://www.tradingview.com/charting-library-docs/latest/configuration/Shortcuts#manage-shortcuts) section.
- **Added a `label` property to StudyOrDrawingAddedToChartEventParams.** The [`label`](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.StudyOrDrawingAddedToChartEventParams#label) property contains the indicator's name as defined in the [`description`](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.RawStudyMetaInfo#description) field of its [metainfo](https://www.tradingview.com/charting-library-docs/latest/custom_studies/metainfo).
- **New featuresets for legend in-place edit.** The `disable_legend_inplace_resolution_change` and `disable_legend_inplace_symbol_change` featuresets control whether users can change the resolution or symbol directly from the [legend](https://www.tradingview.com/charting-library-docs/latest/ui_elements/Legend).
- **Show symbol name in the _Сompare_ dialog.** When the [`use_symbol_name_for_header_toolbar`](https://www.tradingview.com/charting-library-docs/latest/customization/Featuresets#use_symbol_name_for_header_toolbar) featureset is enabled, the symbol [`name`](https://www.tradingview.com/charting-library-docs/latest/connecting_data/Symbology/#name) is displayed in the _Compare_ search dialog instead of [`ticker`](https://www.tradingview.com/charting-library-docs/latest/connecting_data/Symbology/#ticker).
- **Added new time zone for Kabul.**

- **Added new APIs to control the watermark settings.** The [Watermark API](https://www.tradingview.com/charting-library-docs/latest/ui_elements/watermarks#watermark-api-recommended) now has three different properties that can be set independently:
  - [`tickerVisibility`](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.IWatermarkApi/#tickervisibility) to toggle the display of the ticker (e.g. AAPL)
  - [`intervalVisibility`](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.IWatermarkApi/#intervalvisibility) to toggle the display of the interval (e.g. 1h)
  - [`descriptionVisibility`](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.IWatermarkApi/#descriptionvisibility) to toggle the display of the description (e.g. Apple Inc.)
- **The `setVisibleRange` method can be rejected.** [`setVisibleRange`](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.IChartWidgetApi#setvisiblerange) now returns a `Promise` that can be rejected.
- **Added `chart_theme_changed` event to `SubscribeEventsMap`.** The [`chart_theme_changed`](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.SubscribeEventsMap#chart_theme_changed) event is fired when a user applies a saved [chart template](https://www.tradingview.com/charting-library-docs/latest/saving_loading#chart-templates), resets the theme to the default built-in settings, or when the [`changeTheme`](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.IChartingLibraryWidget#changetheme) or [`loadChartTemplate`](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.IChartWidgetApi#loadcharttemplate) methods are called.
- **New `applyTradingCustomization` method.** This method allows you to override the style of order and position lines created with the [Broker API](https://www.tradingview.com/charting-library-docs/latest/trading_terminal/trading-concepts#broker-api) after the widget has been created. (Trading Platform only)
- **Added a date property to `PositionBase`.** [`PositionBase`](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.PositionBase) now has an optional `updateTime` property. (Trading Platform only)
- **Added a `canBeClosed` property to different Position APIs.** Both [`IndividualPositionBase`](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.IndividualPositionBase) and [`IndividualPosition`](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.IndividualPosition) now have an optional `canBeClosed` property to determine if a position can be closed. (Trading Platform only)
- **Added price information (price and profit/loss details) to the tooltip for positions, orders, and brackets.**  (Trading Platform only)
- **Redesigned *Trading settings* panel.** The *Trading settings* panel has been reworked to be more intuitive and provide users with clearer options for customizing their trading view. (Trading Platform only)

**Bug Fixes**

- **Fixed an issue where Spread and Ratio indicators did not work correctly on intraday resolutions.** Previously, the Spread and Ratio indicators did not work correctly on intraday resolutions when the compared symbol had a different session (e.g., 24x7 and 0930-1630).
- **Fixed an issue where the _Long Position_ and _Short Position_ drawings were not reversed correctly.**

- **Fixed a bug that allowed orders to be placed without a price.**  (Trading Platform only)
- **Fixed *Reverse* button color overrides.** Previously, setting override properties for the *Reverse* button within the [`trading_customization`](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.TradingTerminalWidgetOptions#trading_customization) object would result in the button rendering as black. (Trading Platform only)

**Documentation**

- **AI docs assistant.** You can now download a comprehensive knowledge file containing our complete, up-to-date documentation and full TypeScript definitions. Feed this file to your favorite LLM to create a dedicated expert assistant for our library, ensuring you get accurate, context-aware answers and code examples. [Learn how to set it up](https://www.tradingview.com/charting-library-docs/latest/resources/llm-context).
- **New watermarks guide.** The [Watermarks](https://www.tradingview.com/charting-library-docs/latest/ui_elements/watermarks) article explains how to programmatically control the watermark's visibility, color, and content using the Watermark API.
- **New profit and loss article.** The [Profit and loss](https://www.tradingview.com/charting-library-docs/latest/trading_terminal/trading-concepts/profit-and-loss) article explains how to provide P&L values from your backend. It details the different methods for updating the data and clarifies how the library uses this data for the *Money*, *Ticks*, and *Percentage* display modes.
- **Other updates.** The following enhancements were made:
  - Added a new section that describes [time ranges](https://www.tradingview.com/charting-library-docs/latest/ui_elements/Time-Scale#time-range) and how to use `setVisibleRange`.
  - Added a new section that describes [how to show/hide gaps on the chart](https://www.tradingview.com/charting-library-docs/latest/ui_elements/Chart#showhide-gaps-on-the-chart) using the `intraday_inactivity_gaps` featureset.
  - Updated information on [mobile app development](https://www.tradingview.com/charting-library-docs/latest/mobile_specifics#mobile-applications).
  - Updated [`setMinimumAdditionalDepth`](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.IContext#setminimumadditionaldepth) description, mentioning when to use the method.
  - Updated the [Trading primitives](https://www.tradingview.com/charting-library-docs/latest/trading_terminal/Trading-Primitives) article, providing clear explanations and examples on the primitive methods.
  - Updated the [Online playgrounds](https://www.tradingview.com/charting-library-docs/latest/tutorials/Online-Editors) article, providing templates for [CodePen](https://codepen.io/tradingview).
- **Update the Datafeed API tutorial.** We updated both the code example and documentation for the [How to connect data via datafeed API](https://www.tradingview.com/charting-library-docs/latest/tutorials/implement_datafeed_tutorial) tutorial. The latest version introduces several key improvements:

  - Added support for minute and hour resolutions.
  - Removed `full_name` from the `SymbolInfo` object. Now, `ticker` is used instead.
  - `searchSymbols` now properly filters results by user input, selected exchange, and symbol type.
  - `getBars` now selects the correct API endpoint based on the requested `resolution` (minute, hour, or day), ensuring the most appropriate data is used.
  - Reworked streaming logic to support multiple subscriptions to data updates.

---

## Version 29.5.0

*Date: Tue Aug 05 2025*

**Improvements**

- **Improved crosshair movement in tracking mode on mobile.** Previously, the crosshair moved incorrectly in tracking mode when `vert_touch_drag_scroll` was disabled. Now, page scrolling is disabled in tracking mode, allowing the crosshair to move on touch.
- **Added `setLayoutSizes` method to `IChartingLibraryWidget`.** The [`setLayoutSizes`](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.IChartingLibraryWidget#setlayoutsizes) method can be used to resize the charts in [multiple-chart layouts](https://www.tradingview.com/charting-library-docs/latest/trading_terminal#multiple-chart-layout). (Trading Platform only)

**Bug Fixes**

- **Fixed an issue where setMinimumAdditionalDepth would be ignored.** Fixed an issue where custom studies would sometimes not request enough historic bars after calling [`setMinimumAdditionalDepth`](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.IContext/#setminimumadditionaldepth).
- **Fixed an issue where pivot points could be drawn on the wrong bar for overnight sessions.** Fixed an issue where pivot points could be drawn on the wrong bars for symbols with overnight sessions when calculating with a daily timeframe.

---

## Version 29.4.0

*Date: Tue Jun 25 2025*

**New Features**

- **Added new legend property.** A new overrides property `paneProperties.legendProperties.showSeriesLegendCloseOnMobile` was added to hide/show the close value in the legend when on mobile. The default value is `true`.
- **Support multiple tick resolution.** The library now supports multiple [tick resolutions](https://www.tradingview.com/charting-library-docs/latest/connecting_data/time-and-sessions/configure-datafeed-resolutions#resolution-in-ticks). Previously, it was possible to set only `1T` resolution.<br/>
Note that the library does not support tick multipliers. This means it is not possible to build a higher resolution (e.g., `10T`) from a lower one (e.g., `1T`). Therefore, your datafeed must explicitly provide each required resolution. (Trading Platform only)
- **Enabled custom price formatting for Watchlist values.** `priceFormatterFactory` from [`custom_formatters`](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.ChartingLibraryWidgetOptions#custom_formatters) can now be used to format values displayed in the Watchlist columns titled _Last_ and _Chg_. (Trading Platform only)

**Improvements**

- **Updated snapshots functionality in the top toolbar.** Now, handling and storing [snapshots](https://www.tradingview.com/charting-library-docs/latest/ui_elements/Snapshots) rely solely on the [`snapshot_url`](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.ChartingLibraryWidgetOptions#snapshot_url) property.
This means all server-side snapshot actions (*Copy link*, *Open in new tab*, *Tweet image*) must be implemented using your own server.
For details on how to set up your own server, see our guide to [implementing a snapshot server](https://www.tradingview.com/charting-library-docs/latest/tutorials/how-to-guides/implement-snapshots-server).
- **Added the `use_symbol_name_for_header_toolbar` featureset.** This featureset allows you to show the symbol name over the ticker in the _Symbol Search_ dialog.
- **Added `searchSource` parameter to `searchSymbols`.** [`searchSymbols`](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.IDatafeedChartApi#searchsymbols) now receives a new parameter `searchSource` to indicate where the search was triggered from.
- **Added a new property to the `BrokerCustomUI` interface.** [`showReversePositionDialog`](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.BrokerCustomUI#showreversepositiondialog) allows overriding the default *Reverse position* dialog with a custom implementation.
- **Added VWAP insufficient data warning.** Users will now see a warning icon and message in the legend if there isn't enough data loaded to calculate VWAP.
- **Add featureset to display inactivity gaps on intraday charts.** The new `intraday_inactivity_gaps` featureset enables the display of inactivity gaps on intraday charts. These gaps represent periods within the trading session when there has been no trading activity, resulting in missing bars on the chart.<br/>
When `intraday_inactivity_gaps` is enabled, a checkbox appears in the chart settings dialog, allowing users to toggle inactivity gaps on or off. The featureset also exposes the [`intradayInactivityGaps`](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.IChartWidgetApi#intradayinactivitygaps) watched value on the Widget API for programmatic control.
- **Improved data loading efficiency by throttling data requests during user scrolling.** This significantly reduces the frequency of small, incremental requests to the Datafeed API.
- **Order & Position lines display the same information on desktop and mobile.** Users can now benefit from the same design on both desktop and mobile when an order/position is displayed on the chart. (Trading Platform only)

**Bug Fixes**

- **Fixed indicator template favorite menu bug.** Fixed an issue where favoriting an indicator template with leading whitespace in its name caused the quick access button in the header menu to appear empty.
- **Fixed Relative Strength Index indicator.** The Relative Strength Index indicator was broken in version 29.2.0 and has now been fixed.
- **Fixed a bug where switching chart type to a Japanese one would lead to an error in the console.**

- **Fixed vertical line drawing bug.** Fixed an issue where it was impossible to move an existing vertical line drawing to the right of the most recent bar on the chart.
- **Fixed an error when drawing execution shapes on the chart led to an invalid chart state.** Fixes [#9109](https://github.com/tradingview/charting_library/issues/9109)
- **Fixed the spread operator issue in the Compare symbol dialog.** Spread operators now function correctly in the _Compare symbol_ dialog, ensuring consistency with the _Symbol Search_ dialog.
- **Fix for sameorigin.html loading from relative path.** This fix ensures proper loading of the `sameorigin.html` file when using the `iframe_loading_same_origin` featureset and the current page is not the root page.
- **The `_getStyleOverrides` error message.** Fixed a bug where the `_getStyleOverrides` error message could be seen in the console when instantiating the chart with pre-existing orders or positions. (Trading Platform only)
- **Fix rendering of multiple execution shapes on a single bar.** Fixed an issue where adding multiple [execution shapes](https://www.tradingview.com/charting-library-docs/latest/ui_elements/drawings/drawings-api#createexecutionshape) to a single bar would only render the first shape. (Trading Platform only)

**Documentation**

- **New tutorial.** Check out our [new tutorial](https://www.tradingview.com/charting-library-docs/latest/tutorials/implement-broker-api) on how to implement the required methods to enable basic trading functionality using the Broker API.
By the end of this tutorial, you will learn how to enable trading UI and how to store, return, and update orders to make the trading flow functional.
- **New troubleshooting article.** Explore a new article on common [customization issues](https://www.tradingview.com/charting-library-docs/latest/customization/customization-issues) and potential solutions.
- **Other enhancements.** Updated the [Custom themes API](https://www.tradingview.com/charting-library-docs/latest/customization/styles/custom-themes) article and added a new [example](https://codepen.io/tradingview/pen/xbGRaKd) to demonstrate how chart colors can be adjusted using this API.

---

## Version 29.3.0

*Date: Thu May 08 2025*

**New Features**

- **Added HLC bars chart style.** The HLC bars chart style is the same as regular bars but doesn't display the open price. When exporting a series or [overlay](https://www.tradingview.com/charting-library-docs/latest/ui_elements/indicators#add-and-compare-new-series) indicator that uses the HLC bars chart style, open values are not included. Open values also do not appear in the data window or [legend](https://www.tradingview.com/charting-library-docs/latest/ui_elements/Legend) for series or overlay indicators using this style.

**Improvements**

- **Added price scale details to context menu event.** When invoking the [context menu](https://www.tradingview.com/charting-library-docs/latest/ui_elements/context-menu) on the price scale, it now returns the following details:
  - `id` of the price scale
  - `paneIndex` which is the index of the pane the price scale is linked to
  - `chartIndex`  which is the index of the chart the price scale is linked to
- **Added icon to dropdown items.** A new property `icon` was added to the [`DropdownItem`](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.DropdownItem) interface.

**Bug Fixes**

- **Empty context menu.** Fixed an issue where the [context menu](https://www.tradingview.com/charting-library-docs/latest/ui_elements/context-menu) would be partially empty on mobile
- **onContextMenu callback received incorrect arguments.** Fixed a bug where the [`onContextMenu`](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.IChartingLibraryWidget#oncontextmenu) callback received an object instead of the expected arguments.
- **Autosave won't trigger with empty text box created during autosave delay.**
- **Fixed an error where vertical lines would revert to their previous position when moved beyond latest bar.** Fixes [#8894](https://github.com/tradingview/charting_library/issues/8894)

**Documentation**

- **The following enhancements were made.**
  - Added a new section explaining how to [programmatically open and close Symbol Search](https://www.tradingview.com/charting-library-docs/latest/ui_elements/Symbol-Search#openclose-symbol-search).
  - Updated the [Customization overview](https://www.tradingview.com/charting-library-docs/latest/customization) and [Time zones](https://www.tradingview.com/charting-library-docs/latest/ui_elements/timezones) articles.

---

## Version 29.2.0

*Date: Tue Apr 08 2025*

**New Features**

- **Added new methods to Trading Host.** The [Trading Host](https://www.tradingview.com/charting-library-docs/latest/trading_terminal/trading-concepts#trading-host) now includes three new methods designed to clear specific caches and trigger fresh data fetches:
  - [`ordersFullUpdate`](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.IBrokerConnectionAdapterHost#ordersfullupdate)
  - [`positionsFullUpdate`](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.IBrokerConnectionAdapterHost#positionsfullupdate)
  - [`individualPositionsFullUpdate`](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.IBrokerConnectionAdapterHost#individualpositionsfullupdate)
- **Added cross-tab synchronization for watchlists.** This feature is enabled by default and requires the `use_localstorage_for_settings` [featureset](https://www.tradingview.com/charting-library-docs/latest/customization/Featuresets) to be enabled.
To disable the cross-tab synchronization, use the `watchlist_cross_tab_sync` featureset. (Trading Platform only)

**Improvements**

- **New `resetCache` method.** The new `resetCache` method allows you to delete previously loaded data for all symbol and resolution combinations known to the datafeed at once. You can use this method instead of [`onResetCacheNeededCallback`](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.IDatafeedChartApi#subscribebars) to clear the cache before calling [`resetData`](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.IChartWidgetApi#resetdata). In this case, you do not need to wait for [`subscribeBars`](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.IDatafeedChartApi#subscribebars) to be called to access the callback.

**Bug Fixes**

- **Save button tooltip still shows shortcut when `save_shortcut` is disabled.** Fixed a bug where the _Save_ button's tooltip still showed the shortcut when the `save_shortcut` featureset was disabled. Fixes [#8925](https://github.com/tradingview/charting_library/issues/8925)
- **Compare Symbol search dialog behavior.** Fixed an issue where the library would try to resolve a symbol that may not exist when users pressed _Enter_ whenever the featureset `allow_arbitrary_symbol_search_input` would be enabled.
- **Adding a custom interval could cause an error.** Adding a custom interval after enabling the [`custom_resolution`](https://www.tradingview.com/charting-library-docs/latest/customization/Featuresets#custom_resolutions) featureset used to cause a console error.
- **Fixed an issue where on some occasions PineJS functions would not return the right values when internally comparing it to MIN_VALUE or MAX_VALUE.**

- **Future bar time extrapolation with `disable_resolution_rebuild`.** Fixed an issue where future bar times would be extrapolated incorrectly when the `disable_resolution_rebuild` featureset was enabled, and daily bars that do not consider the January 1 to be the first day of the year were provided to the library.
- **Compare symbol legend context menu.** Fixed an issue where the context menu for compared symbols would show the _Add this indicator to favorites_ item.
- **Main series context menu.** Fixed an issue where the [context menu](https://www.tradingview.com/charting-library-docs/latest/ui_elements/context-menu) for the main series would show a blank space instead of the _Add SYMBOL to watchlist_ item.
- **Watchlist item counter.** Fixed an issue where the watchlist item count would include section titles in its calculation.
- **Fixed an issue with time scale marks that couldn't contain any underscore character.**

- **Fixed a bug where `getBars` failed to display error messages containing semicolons.**

- **Fixed drawing keyboard shortcuts.** Fixed an issue where using keyboard shortcuts to add drawings would sometimes open the _Symbol Search_ dialog instead of adding the intended drawing.

**Documentation**

- **The following enhancements were made.**
  - Added a new section explaining how to [display pre- and post-market price lines](https://www.tradingview.com/charting-library-docs/latest/connecting_data/time-and-sessions/Extended-Sessions#enable-the-price-line).
  - Added a new section explaining how to [provide profit and loss values](https://www.tradingview.com/charting-library-docs/latest/trading_terminal/trading-concepts/profit-and-loss) in Trading Platform.
  - Updated the [Trading Session](https://www.tradingview.com/charting-library-docs/latest/connecting_data/time-and-sessions/Trading-Sessions) article with information on how to specify [session history](https://www.tradingview.com/charting-library-docs/latest/connecting_data/time-and-sessions/Trading-Sessions#session-history)

---

## Version 29.1.0

*Date: Fri Mar 07 2025*

### New Features

- **Added the _Another symbol_ input field to Moving Average Multiple, Moving Average Triple, and Pivot Points Standard.** This field allows users to specify a different symbol for calculating the indicator. By default, the current symbol on the chart is used.<ReleaseNoteAnchor id="v29_1-added_other_symbol_to_moving_average_multiple_and_triple" /><br/>

#### Trading Platform only

- **Pre-/post-market lines.** Added the `pre_post_market_price_line` featureset that allows you to enable or disable the pre-/post-market price lines. To display the pre-/post-market lines, you need to provide the `rtc` property in [quotes](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Datafeed.DatafeedQuoteValues).<ReleaseNoteAnchor id="v29_1-pre_post_market_lines" /><br/>

### Improvements

- **Adds an offset input to the Bollinger Bands indicator.**
- **Allow overriding the default shortcuts.** Now, you can override the default shortcuts using the [`onShortcut`](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.IChartingLibraryWidget#onshortcut) method. Note that modal dialogs shortcuts cannot be changed.

### Documentation

- **New articles.** Explore our latest articles:
  - [Object tree](https://www.tradingview.com/charting-library-docs/latest/ui_elements/object-tree) — an overview of the feature.
  - [Quotes](https://www.tradingview.com/charting-library-docs/latest/trading_terminal/trading-concepts/quotes) — an article explaining the importance of quotes in Trading Platform.

- **Other updates.** The following enhancements were made:
  - Updated the guide on [how to add a custom page to the Account Manager](https://www.tradingview.com/charting-library-docs/latest/tutorials/how-to-guides/create-custom-page-in-account-manager). It now describes how to make the symbol name clickable on the custom page.
  - Added a guide on how to troubleshoot when [quotes are not displayed or refreshed](https://www.tradingview.com/charting-library-docs/latest/connecting_data/Datafeed-Issues#quotes-are-not-displayed-or-refreshed).
  - Added a guide on how to troubleshoot [delays in Trading Platform UI elements](https://www.tradingview.com/charting-library-docs/latest/connecting_data/Datafeed-Issues#delays-in-trading-platform-ui-elements).
  - Added a new FAQ — [Does the library set cookies](https://www.tradingview.com/charting-library-docs/latest/resources/Frequently-Asked-Questions#other-questions).

---

## Version 29.0.0

*Date: Wed Feb 05 2025*

**Breaking Changes**

- **Removed trading API methods from Advanced Charts.** The following methods are now available exclusively in Trading Platform. If you’re using Advanced Charts, these methods will no longer be accessible.
  - [`createOrderLine`](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.IChartWidgetApi#createorderline)
  - [`createPositionLine`](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.IChartWidgetApi#createpositionline)
  - [`createExecutionShape`](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.IChartWidgetApi#createexecutionshape)
- **Changed the `getPositionDialogOptions` signature.** The [`getPositionDialogOptions`](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.IBrokerCommon#getpositiondialogoptions) method is asynchronous and returns a promise now. The method also expects a symbol as a parameter.
- **Broker API simplification.** To further improve and simplify the library, we have merged the two existing APIs, `IBrokerWithoutRealtime` and `IBrokerTerminal`, and now exclusively expose the latter. Additionally, we have removed the `subscribeDOM`/`unsubscribeDOM` methods, as they were rarely used and duplicated the functionality of [`subscribeDepth`](https://www.tradingview.com/charting-library-docs/latest/connecting_data/datafeed-api/trading-platform-methods#subscribedepth)/[`unsubscribeDepth`](https://www.tradingview.com/charting-library-docs/latest/connecting_data/datafeed-api/trading-platform-methods#unsubscribedepth). This change ensures that the datafeed fully handles all data management responsibilities.
- **Removed the Anchored Note drawing.**
- **Renamed the Note drawing to Pin.**
- **Updated the default colors for drawings/indicators with Volume Profiles.**
- **Added MACD smoothing inputs.**
- **Drawing creation methods now return Promises instead of synchronous values.** The drawing creation methods ([`createShape`](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.IChartWidgetApi#createshape), [`createMultipointShape`](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.IChartWidgetApi#createmultipointshape), and [`createAnchoredShape`](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.IChartWidgetApi#createanchoredshape)) now return Promises that resolve to the drawing ID. The methods also throw an Error through a rejected Promise when the drawing creation fails, instead of returning `null`.
- **Trading Platform methods for drawing creation now return Promises instead of synchronous values.** The ([`createOrderLine`](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.IChartWidgetApi#createorderline), [`createPositionLine`](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.IChartWidgetApi#createpositionline), and [`createExecutionShape`](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.IChartWidgetApi#createexecutionshape)) methods now return Promises that resolve to the corresponding API interface.  (Trading Platform only)

**New Features**

- **Added the _Another symbol_ input field to Ichimoku Cloud, Bollinger Bands, and Average Price.** This field allows users to specify a different symbol for calculating the indicator. By default, the current symbol on the chart is used.
- **New properties for customizing order and position lines.** You can now override the style of order and position lines created with the [Broker API](https://www.tradingview.com/charting-library-docs/latest/trading_terminal/trading-concepts#broker-api).
The [`trading_customization`](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.TradingTerminalWidgetOptions#trading_customization) option in the Widget Constructor now supports `brokerOrder` and `brokerPosition` properties.
For more details, see the [Trading Overrides](https://www.tradingview.com/charting-library-docs/latest/customization/overrides/trading-overrides#created-with-broker-api) article. (Trading Platform only)

**Improvements**

- **Added an option to keep the leftmost bar visible after resolution switching.** By default, the library resets the chart to the latest data when the resolution is changed. To keep the current time range, users can enable the Save chart left edge position when changing interval option in *Chart settings* → *Scales*.
- **Added option to hide/show scroll to the most recent bar button.** The presence of the *Scroll to the most* recent bar button now depends on the Navigation buttons settings (*Chart settings* → *Canvas* → *Buttons* → *Navigation*).
- **Added a new `paneIndex` getter to the `StudyAPI`.** The [`paneIndex`](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.IStudyApi#paneindex) function returns the index of the pane the indicator belongs to.
- **Enabled users to adjust coordinates of Parallel Channel within the drawing settings.**
- **Enabled users to reverse the Long/Short Position drawings.**
- **Buy/Sell buttons' visibility can now be changed for each chart in the layout.**
- **Added the Volume option for the Date Range and Date & Price Range tools.**
- **Added multiline option for Parallel Channel.** Additional level lines have been added.
- **Show price line of Heikin Ashi on real price when the real price label is selected.** On Heikin Ashi chart, the price line now matches the position of the *Last price* label when the *Real prices on price scale (instead of Heikin-Ashi price)* setting is enabled.
- **Added new time zone Azores (UTC-1).**
- **Added an error message for unsupported resolutions.** If the selected resolution is not supported by the current symbol, an error message appears on the chart along with a button to switch to a supported resolution.
- **Implemented dynamic loading for drawings to optimize bundle size.** Drawings have been refactored to utilize dynamic imports, reducing the initial bundle size by loading these components on-demand. This optimization results in faster initial page loads and improved application startup time, while maintaining full drawing functionality through lazy loading when tools are actually accessed by users.
- **Added a star icon to chart context menu for indicator.** This icon is displayed next to the _Add this indicator to favorites / Remove this indicator_ from favorites option in the indicator context menu.
- **Changed the return type for `OrderPreviewResult`.** When implementing [`previewOrder`](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.IBrokerTerminal#previeworder), you can specify links to external URLs now. The links will be displayed within the `warnings` or `errors` block.   (Trading Platform only)

**Bug Fixes**

- **Fixed unreliable onChartReady callback with cached bundles.** When using `iframe_loading_compatibility_mode` with cached library bundles, the `onChartReady` callback would sometimes fail to execute. Fixes [#8889](https://github.com/tradingview/charting_library/issues/8889)
- **Long/Short Position tools are extended to the right if the next bar crosses stop/profit level.** Fixed a bug where Long/Short Position would get partially extended to the right if the next bar crossed the stop/profit level.
- **Fixed hovering on the indicator legend.** Now, when an indicator is deleted via the legend, the hover state shifts to the legend of the next indicator below.
- **Fixed an issue when cloning drawings that were not selected.** Fixed a bug where _Ctrl+Drag_ would create copies of the last selected drawings on chart, even if they were no longer selected. Now, this shortcut enables area selection.

**Documentation**

- **New how-to guide.** Check out a new [guide](https://www.tradingview.com/charting-library-docs/latest/tutorials/how-to-guides/add-custom-button-to-top-toolbar) on how to add a custom button to the top toolbar.
- **Other updates.** The following enhancements were made:
  - Added a new section that explains [multiple symbol resolving](https://www.tradingview.com/charting-library-docs/latest/connecting_data/datafeed-api/required-methods#multiple-symbol-resolving).
  - Updated the [Toolbars](https://www.tradingview.com/charting-library-docs/latest/ui_elements/Toolbars) article.
  - Added a new [section](https://www.tradingview.com/charting-library-docs/latest/ui_elements/Chart#execute-action-by-id) that describes how to trigger specific actions, such as opening the *Chart settings* dialog, using the [`executeActionById`](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.IChartWidgetApi#executeactionbyid) method.
  - Added an [overview](https://www.tradingview.com/charting-library-docs/latest/product-comparison) of other TradingView products.

---

## Version 28.5.0

*Date: Wed Dec 18 2024*

**New Features**

- **Added `baselinePosition` property for column series.** The [`baselinePosition`](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.ColumnStylePreferences#baselineposition) property allows column series to be drawn relative to the specified baseline value.
  - The default value is `'bottom'`, which draws columns with the bottom of the chart pane as their baseline.
  - Setting the value to `'zero'` draws columns with a baseline of 0, displayed as either 0% or 0.00 depending on the price scale mode.
- **Added the _Another symbol_ input field to Moving Average Double.** This field allows users to specify a different symbol for calculating the indicator. By default, the current symbol on the chart is used.

**Documentation**

- **New how-to guide.** Check out a new [guide](https://www.tradingview.com/charting-library-docs/latest/tutorials/how-to-guides/create-custom-page-in-account-manager) that explains how to create a custom page in the Account Manager.
- **Other updates.** The following enhancements were made:
  - Added a new section that explains how to enable and specify [last day change values](https://www.tradingview.com/charting-library-docs/latest/ui_elements/Legend#last-day-change-values).
  - Updated information on [overnight sessions](https://www.tradingview.com/charting-library-docs/latest/connecting_data/time-and-sessions/Trading-Sessions#overnight-sessions).
  - Updated information on how to [close](https://www.tradingview.com/charting-library-docs/latest/trading_terminal/trading-concepts/positions#close-positions) and [reverse](https://www.tradingview.com/charting-library-docs/latest/trading_terminal/trading-concepts/positions#reverse-positions) positions.
  - Updated API overview page.

## Version 28.4.0

*Date: Thu Nov 28 2024*

**New Features**

- **Added `includeOHLCValuesForSingleValuePlots` option when exporting data.** When set to `true`, this option forces all four OHLC plot values to be exported, even if the plot has a single value. This applies, for example, when the symbol has `visible_plots_set: 'c'` or when the exported plot is a single-value style (Area, Baseline, Line, Line with markets, Stepline, or Column).

**Improvements**

- **Added logging of quotes events.** Added extra logging of quote events when [debug mode](https://www.tradingview.com/charting-library-docs/latest/tutorials/enable-debug-mode#enable-debug-mode-for-data-connection) is enabled. The logs will contain information about quote data requests, real-time subscribe and unsubscribe events, and alerts for data requests that do not respond within 10 seconds.

**Bug Fixes**

- **Fixed an issue where missing translations caused errors when opening the settings dialog of the Ichimoku Cloud indicator.**
- **Fixed an issue where the Point and Figure series would not be displayed.**

**Documentation**

- **New articles.** Explore our latest articles:
  - [Positions](https://www.tradingview.com/charting-library-docs/latest/trading_terminal/trading-concepts/positions) — an article that overviews position types supported in the library and describes how to manage them.
  - [UI elements](https://www.tradingview.com/charting-library-docs/latest/ui_elements) — an overview of the library's UI elements.
  - [News](https://www.tradingview.com/charting-library-docs/latest/trading_terminal/news) — an article that explains how to connect data to the _News_ widget.
- **Other updates.** The following articles were improved:
  - [Custom themes API](https://www.tradingview.com/charting-library-docs/latest/customization/styles/custom-themes)
  - [CSS color themes](https://www.tradingview.com/charting-library-docs/latest/customization/styles/CSS-Color-Themes)
  - [Market Status](https://www.tradingview.com/charting-library-docs/latest/ui_elements/market-status)

## Version 28.3.0

*Date: Thu Oct 24 2024*

**New Features**

- **Symbol name in the Watchlist and Details widgets.** Now, the [`DatafeedQuoteValues.short_name`](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Datafeed.DatafeedQuoteValues#short_name) value is displayed as a symbol's short name in the [Watchlist](https://www.tradingview.com/charting-library-docs/latest/trading_terminal/Watch-List) and [Details](https://www.tradingview.com/charting-library-docs/latest/trading_terminal#details).
 You can disable the [`prefer_quote_short_name`](https://www.tradingview.com/charting-library-docs/latest/customization/Featuresets#prefer_quote_short_name) featureset to revert to the old behavior. In this case, the [`ticker`](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.LibrarySymbolInfo#ticker) value will be used instead. `Trading Platform Only`

**Bug Fixes**

- **Anchored Note in multi-layout.** Fixed an issue where plotting a saved Anchored Note in multi-layout would raise an error. `Trading Platform Only`
- **Fixed symbol logo persistence in legend.** Resolved an issue where a failed image load (e.g., a 404 error) for a symbol logo would cause the previous logo to persist in the legend. Now, the legend correctly updates to reflect the absence of a logo when loading fails. See the [Symbol logos](https://www.tradingview.com/charting-library-docs/latest/ui_elements/Legend#symbol-logos) section of the Legend documentation for more details on the feature.
- **Fixed ordering of symbol logos.** Fixed an issue where symbol logos with two URLs defined in [`logo_urls`](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.LibrarySymbolInfo#logo_urls) were displayed in an inconsistent order. The order has been corrected on the chart legend and within the Account Manager table.

## Version 28.2.0

*Date: Tue Oct 01 2024*

**New Features**

- **Added `Rank Correlation Index` indicator.**
- **Support building seconds bars from ticks.** Trading Platform now supports building seconds bars from ticks for symbols configured to support it. Compatible symbols must set the [`build_seconds_from_ticks`](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.LibrarySymbolInfo#build_seconds_from_ticks) flag to `true`. Additionally, [`has_seconds`](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.LibrarySymbolInfo#has_seconds) and [`has_ticks`](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.LibrarySymbolInfo#has_ticks) must be `true`, and [`seconds_multipliers`](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.LibrarySymbolInfo#seconds_multipliers) must be an empty array or only contain multipliers that the datafeed provides itself. `Trading Platform Only`
- **Sped up sorting animation in the Account Manager.** Raised by [#8760](https://github.com/tradingview/charting_library/issues/8760) `Trading Platform Only`

**Improvements**

- **Added an option to customize the default Volume MA calculation in the Volume indicator.** By default, the Volume MA, optionally plotted in the Volume indicator, used the SMA calculation. We have now introduced two additional options: EMA and WMA.
- **Added new event to `SubscribeEventsMap`.** The [`timeframe_interval`](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.SubscribeEventsMap#timeframe_interval) event is triggered when the one of the bottom left intervals is selected or the [`setTimeFrame`](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.IChartWidgetApi#settimeframe) API is used.
- **Added a symbol change to MACD indicator.** It is now possible to change the targeted symbol when plotting MACD indicator without using the main series.

## Version 28.1.0

*Date: Wed Sep 04 2024*

**Breaking Changes**

- **Deprecated API methods.** [`activateBottomWidget`](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.IBrokerConnectionAdapterHost#activatebottomwidget) is now marked `deprecated`. Please use [`setAccountManagerVisibilityMode`](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.IBrokerConnectionAdapterHost#setaccountmanagervisibilitymode) instead.
If you want to retrieve the current state of the Account Manager please use [`getAccountManagerVisibilityMode`](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.IBrokerConnectionAdapterHost#getaccountmanagervisibilitymode)

**New Features**

- **Added `iframe_loading_same_origin` featureset.** The `iframe_loading_same_origin` featureset ensures the library's iframe is loaded from the same domain as the `library_path` files.

**Improvements**

- **Added new event to `SubscribeEventsMap`.** The [`study_dialog_save_defaults`](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.SubscribeEventsMap#study_dialog_save_defaults) event is triggered when the _Save as default_ option is selected in the indicator settings.
- **Changed the return type for `OrderPreviewResult`.** When implementing [`previewOrder`](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.IBrokerTerminal#previeworder), you can specify links to external URLs now. The links will be displayed within the `warnings` or `errors` block.  `Trading Platform Only`
- **Added an item counter for custom pages.** By default, custom pages added to the [Account Manager](https://www.tradingview.com/charting-library-docs/latest/trading_terminal/account-manager) do not display the number of items in their corresponding table. Enabling [`displayCounterInTab`](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.AccountManagerPage#displaycounterintab) will show this number next to the tab title.  `Trading Platform Only`

**Bug Fixes**

- **charting_library_debug_mode.** Fixed an issue where enabling the featureset `charting_library_debug_mode` was of no effect.

- **Instant display of refreshed marks.** Fixed an issue where new [marks](https://www.tradingview.com/charting-library-docs/latest/ui_elements/Marks) added after calling [`refreshMarks`](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.IChartWidgetApi#refreshmarks) were not immediately displayed on the chart. Previously, these marks only appeared after user interaction, but now they are instantly visible once the data is provided.
- **Fixed an issue with `multiple_watchlists` featureset.** When the `multiple_watchlists` featureset was disabled, it was still possible to see the `Create a new list` option under the Watchlist drop-down menu.

**Documentation**

- **New how-to guide.** Check out a new guide on [enabling debug modes](https://www.tradingview.com/charting-library-docs/latest/tutorials/enable-debug-mode) to help identify potential issues when implementing your app and ensure it is running smoothly.

## Version 28.0.0

*Date: Wed Aug 14 2024*

**Breaking Changes**

- **Removed `full_name`.** The `LibrarySymbolInfo.full_name` property was removed from public API. The property contained strings in the `'EXCHANGE:SYMBOL'` format and was used to request data from the datafeed. Therefore:
  - Now, you should use either the [`name`](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.LibrarySymbolInfo#name) or [`ticker`](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.LibrarySymbolInfo#ticker) property to specify an identifier for a certain symbol. For more information, refer to the [Symbology](https://www.tradingview.com/charting-library-docs/latest/connecting_data/Symbology#symbol-name) article.
  - Instead of `'EXCHANGE:SYMBOL'`, the library will send either `name` or `ticker` values to the datafeed when calling methods such as [`getBars`](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.IDatafeedChartApi#getbars), [`getQuotes`](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.IDatafeedQuotesApi#getquotes), and [`subscribeQuotes`](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.IDatafeedQuotesApi#subscribequotes).
  - The `'EXCHANGE:SYMBOL'` strings are no longer displayed in the Trading Platform UI. The symbol name will be used instead. You can disable the [`prefer_symbol_name_over_fullname`](https://www.tradingview.com/charting-library-docs/latest/customization/Featuresets#prefer_symbol_name_over_fullname) featureset to revert to the old behavior. `Trading Platform Only`
- **Deprecated API methods.** The following methods are now marked `deprecated` for the Advanced Charts users.
  - [`createOrderLine`](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.IChartWidgetApi#createorderline)
  - [`createPositionLine`](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.IChartWidgetApi#createpositionline)
  - [`createExecutionShape`](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.IChartWidgetApi#createexecutionshape)

  These methods will be removed from the Advanced Charts library in the next major version.
  However, they will still be available in Trading Platform.
- **Make `cancelOrders` optional.** The [`cancelOrders`](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.IBrokerWithoutRealtime#cancelorders) method is marked as optional because the library calls it only for the [Depth of Market](https://www.tradingview.com/charting-library-docs/latest/trading_terminal#depth-of-market) widget. `Trading Platform Only`
- **Removed the `calculatePLUsingLast` flag.** The `calculatePLUsingLast` [broker configuration flag](https://www.tradingview.com/charting-library-docs/latest/trading_terminal/trading-concepts/trading-features-configuration) has been removed. `Trading Platform Only`
- **Symbol search dialog behavior.** Previously, when users pressed _Enter_ in the [_Symbol Search_](https://www.tradingview.com/charting-library-docs/latest/ui_elements/Symbol-Search) dialog, they could enter arbitrary input directly. This input was passed to the datafeed for resolution and loading, regardless of whether the input matched any search results.<br />
Now, pressing _Enter_ selects the top search result unless the user has explicitly chosen another item. If there are no search results, pressing _Enter_ will have no effect. You can enable the [`allow_arbitrary_symbol_search_input`](https://www.tradingview.com/charting-library-docs/latest/customization/Featuresets#allow_arbitrary_symbol_search_input) featureset to use the old behavior.
- **Change custom translation API.** Change the [custom_translate_function](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.ChartingLibraryWidgetOptions#custom_translate_function) interface to accept different parameters: the original text, the singular original text, and the translated text. For example "prices", "price", "prix".
- **Changed the behavior of data display in the Depth of Market widget.** Now, data is displayed in static mode.
This means that the price series is fixed, while the current price moves within, above, or below the designated range.
To center on the current price, click the centering button (<svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M3.57821 9.5C3.81565 12.1079 5.89214 14.1843 8.5 14.4218V16H9.5V14.4218C12.1079 14.1843 14.1843 12.1079 14.4218 9.5H16V8.5H14.4218C14.1843 5.89214 12.1079 3.81565 9.5 3.57821V2H8.5V3.57821C5.89214 3.81565 3.81565 5.89214 3.57821 8.5H2V9.5H3.57821ZM8.5 6V4.58337C6.44491 4.81345 4.81345 6.44491 4.58337 8.5H6V9.5H4.58337C4.81345 11.5551 6.44491 13.1866 8.5 13.4166V12H9.5V13.4166C11.5551 13.1866 13.1866 11.5551 13.4166 9.5H12V8.5H13.4166C13.1866 6.44491 11.5551 4.81345 9.5 4.58337V6H8.5Z" fill="#131722"/></svg>) or use the *Shift + Alt/Option + C* shortcut.
Previously, centering was applied dynamically.
- **Renamed the Symbol Info dialog.** The _Symbol Info_ dialog and the corresponding items in context menus are called _Security Info_ now. [#8444](https://github.com/tradingview/charting_library/issues/8444)
- **Renamed ErrorCallback to DatafeedErrorCallback.** `ErrorCallback` used in `IDatafeedChartApi` has been renamed to `DatafeedErrorCallback`.
- **Updated `selectedCurrency` behavior.** In `CurrencyInfo`, the [`selectedCurrency`](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.CurrencyInfo#selectedcurrency) property now returns `null` instead of `"Mixed"` when price scales contain mixed currencies.
- **Deprecated property.** The `brokerConfig` property in the [`TradingTerminalWidgetOptions`](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.TradingTerminalWidgetOptions) interface is deprecated and will be removed in the next major release.
Use the [`broker_config`](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.TradingTerminalWidgetOptions#broker_config) property instead.

**New Features**

- **New Custom themes API.** This API allows you to customize colors of the chart elements including toolbars, dialogs, and buttons.
To do this, you should specify your own theme with a custom color palette.
For more information, refer to the [Custom themes API](https://www.tradingview.com/charting-library-docs/latest/customization/styles/custom-themes) article.
- **Added Volume Candles chart style.** This chart style allows for a visual assessment of the volume of trades for each candle. These are still candlesticks, but the width of each candle depends on the volume of trades during the period of formation of this candle. The greater the trading volume during the formation period of the candle, the larger the width of the candle.
To display Volume Candles, select the corresponding option in the drop-down menu on the top toolbar.

**Improvements**

- **Behavior change for `chartContextMenuActions`.** When the [`chartContextMenuActions`](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.IBrokerWithoutRealtime#chartcontextmenuactions) method returns an empty array, the _Trade_ item within the chart [context menu](https://www.tradingview.com/charting-library-docs/latest/ui_elements/context-menu) will not be displayed. Previously, the item was rendered but grayed out. `Trading Platform Only`
- **Added the `library_custom_fields` property to the `LibrarySymbolInfo` interface.** This property is used to include additional metadata in the symbol information. The metadata will not be processed by the library.
- **Added extra properties to `symbolExt` method.** The [`symbolExt`](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.IChartWidgetApi#symbolext) method now returns additional properties including `ticker`.
- **Added the `debug_broker` option to the Widget Constructor.** When [`debug_broker`](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.TradingTerminalWidgetOptions#debug_broker) is specified, the library logs calls and responses to [`IBrokerWithoutRealtime`](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.IBrokerWithoutRealtime) and [`IBrokerConnectionAdapterHost`](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.IBrokerConnectionAdapterHost) in the browser console. You can set `debug_broker` to one of the debug levels defined by [`BrokerDebugMode`](https://www.tradingview.com/charting-library-docs/latest/api/modules/Charting_Library#brokerdebugmode). `Trading Platform Only`
- **Updated the Anchored VWAP drawing.** Add bands settings to the Anchored VWAP drawing.
- **Added new methods to the Trading Host.** The `getOrderTicketSetting` and `setOrderTicketSetting` methods have been added to the [`IBrokerConnectionAdapterHost`](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.IBrokerConnectionAdapterHost) interface. These methods allow you to read and adjust Order Ticket settings. `Trading Platform Only`
- **Changed `const enum` to `enum` in the library type declarations.** This change allows you to import enums from the library in a TypeScript environment with the [`isolatedModules`](https://www.typescriptlang.org/tsconfig/#isolatedModules) option enabled, such as when using Vite or similar tools.
- **Added the `hideStudiesFromLegend` option to `ClientSnapshotOptions`.** When `hideStudiesFromLegend` is set to true, the legend within the generated screenshots won't contain any studies applied to the chart.
- **Exposed `connectionStatusUpdate` from `IBrokerConnectionAdapterHost`.** An existing [`connectionStatusUpdate`](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.IBrokerConnectionAdapterHost#connectionstatusupdate) API has been exposed for [`IBrokerConnectionAdapterHost`](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.IBrokerConnectionAdapterHost) to help reflect connection status changes throughout the application lifecycle. `Trading Platform Only`
- **New keyboard shortcuts.** The following [shortcuts](https://www.tradingview.com/charting-library-docs/latest/configuration/Shortcuts) were added:
  - _Shift_ + _Mouse wheel_  — scroll the chart horizontally
  - _Shift_ + _Alt_ + _B_ — place limit order to buy
  - _Shift_ + _Alt_ + _S_ — place limit order to sell
- **Enabled in-place editing for drawing texts.** For the following drawings, users can now add custom text and edit it on the chart:
  - _Fib Retracement_
  - _Trend-based Fib Extension_
  - _Horizontal_ and _Vertical Line_
  - _Trend Line_
  - _Info Line_
  - _Ray_
  - _Extended Line_
  - _Signpost_
  - _Note_
  - _Anchored Note_
  - _Comment_
  - _Rectangle_
  - _Ellipse_
  - _Circle_

  To enter the text, users should click the _+Add text_ placeholder that appears on hover.
- **Disabled color pickers in Chart settings.** If a certain price label or line is hidden on the chart, users cannot adjust the color of this label/line in the _Chart settings_ dialog.
- **Time zones.** Time zone updates:
  - Changed the Almaty (UTC+6) time zone to Astana (UTC+5).
  - Added the new Kuala Lumpur (UTC+8) time zone.
- **Visibility of price labels for risk-reward drawings.** Previously, price labels for the _Long position_ and _Short position_ drawings could be either hidden entirely or always displayed.
Now, if the price labels are disabled for a certain drawing, the labels will be displayed when the drawing is selected.
- **Accessibility improvement.** Users can now select the following elements in the _Legend_ when navigating with the keyboard.
  - The _More_ (<svg width="16" height="4" viewBox="0 0 16 4" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="2" cy="2" r="1.5" stroke="currentColor"/><circle cx="8" cy="2" r="1.5" stroke="currentColor"/><circle cx="14" cy="2" r="1.5" stroke="currentColor"/></svg>) button and items in the corresponding menu
  - The _Remove_ (<svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg"><path d="M7.5 4a.5.5 0 0 0-.5.5V5h4v-.5a.5.5 0 0 0-.5-.5h-3ZM12 5h3v1h-1.05l-.85 7.67A1.5 1.5 0 0 1 11.6 15H6.4a1.5 1.5 0 0 1-1.5-1.33L4.05 6H3V5h3v-.5C6 3.67 6.67 3 7.5 3h3c.83 0 1.5.67 1.5 1.5V5ZM5.06 6l.84 7.56a.5.5 0 0 0 .5.44h5.2a.5.5 0 0 0 .5-.44L12.94 6H5.06Z" fill="currentColor"/></svg>) button
- **Added new multiple-chart layouts combinations.** `Trading Platform Only`
- **New style settings for the Note drawing.** Now:
  - The _Background_ and _Border_ settings are optional.
  - The default color of the drawing depends on the current chart [theme](https://www.tradingview.com/charting-library-docs/latest/customization#theme).

**Bug Fixes**

- **Fixed the _Pivot Points Standard_ compatibility with Japanese chart types.** The _Pivot Points Standard_ indicator used to cause the _Assertion failed: data must have unique sorted times_ error when applied to chart types such as Line Break, Renko, Kagi, and Point-and-Figure under certain data conditions.
- **Workaround for corrupted chart layouts.** In rare cases, chart layouts can become corrupted and cause a _DEFAULT_SYMBOL is not defined_ error when loaded by the library. To work around this error, set [`symbol`](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.ChartingLibraryWidgetOptions#symbol) to be used as a fallback for any corrupted charts.
- **Fixed an issue where 0-volume data were not displayed in the Legend.** [#8662](https://github.com/tradingview/charting_library/issues/8662)
- **Fixed the time indicator.** The time indicator now correctly moves across the timeline in the [Market Status](https://www.tradingview.com/charting-library-docs/latest/ui_elements/Symbol-Status) pop-up.
- **Fixed resizing for risk-reward tools.** The resizing of _Long position_ and _Short position_ drawings works correctly now. [#8513](https://github.com/tradingview/charting_library/issues/8513)
- **Fixed changing of drawing coordinates.** The setting dialog used to crash when users changed coordinates of drawings such as _Anchored Volume Profile_, _Fixed Range Volume Profile_, and _Regression Trend_.
- **Fixed the drawing settings bug.** Previously, when users clicked _Hide/Show_ on a drawing, the settings applied to this drawing would override the default ones. Now, changing drawing visibility does not affect the default settings. [#8434](https://github.com/tradingview/charting_library/issues/8434)
- **Fixed colors of the scale buttons.** The colors of the _A_ (auto) and _L_ (log) scale buttons match the chart background color now. [#8459](https://github.com/tradingview/charting_library/issues/8459)
- **Fixed bugs on the multiple-chart layout.** `Trading Platform Only` The following bugs were fixed:
  - The _Long/Short Position_ drawing used to cause errors if the drawing was hidden for a certain resolution and that resolution was currently displayed on the chart.
  - Synchronized _Path_ and _Polyline_ drawings were not displayed on larger resolutions if the first two points of the drawing were set at the same level on a smaller resolution.
  - The _Curve_ and _Double Curve_ drawings used to cause errors if a user moved the drawing before enabling layout synchronization.
  - Changing the Profit/Stop level of the synchronized _Long/Short Position_ drawing used to cause errors if the drawing was hidden for a certain resolution and that resolution was currently displayed on the chart.

**Documentation**

- **Updated types for overrides.** The following categories of overrides within the
[`ChartPropertiesOverrides`](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.ChartPropertiesOverrides)
have been added or updated:
  - Added types for the Step line chart style (`mainSeriesProperties.steplineStyle.*`).
  - Updated the types for `paneProperties.*`.
  - Added overrides that affect Trading Platform features (`tradingProperties.*`).
- **New articles.** Explore our latest articles:
  - [How to create a custom indicator](https://www.tradingview.com/charting-library-docs/latest/tutorials/how-to-guides/create-custom-indicator) — a step-by-step tutorial that demonstrates the Moving Average implementation.
  - [Custom indicators. Inputs](https://www.tradingview.com/charting-library-docs/latest/custom_studies/metainfo/Custom-Studies-Inputs) — an overview of how to specify and manage input parameters for a custom indicator.
  - [Authentication](https://www.tradingview.com/charting-library-docs/latest/trading_terminal/trading-concepts/authentication) — an article that outlines possible authentication approaches. `Trading Platform Only`

## Version 27.006

*Date: Tue May 21 2024*

**Bug Fixes**

- **Resolve quotes with ticker instead of symbol name.** The library will now request quote data using the [`ticker`](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.LibrarySymbolInfo#ticker) property. If `ticker` is not provided in the `LibrarySymbolInfo` object, the `name` property will be used instead. This should resolve an issue some customers were experiencing where quote data was not being properly displayed in the [Watchlist](https://www.tradingview.com/charting-library-docs/latest/trading_terminal/Watch-List) and [Legend](https://www.tradingview.com/charting-library-docs/latest/ui_elements/Legend).

## Version 27.005

*Date: Tue May 07 2024*

**Improvements**

- **Update the Anchored AVWAP drawing.** Add bands settings to the Anchored VWAP drawing.
- **Subscribe to widget bar visibility events.** A new [`study_event`](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.SubscribeEventsMap.md#study_event) type was added: `widgetbar_visibility_changed`. It returns the visibility state of the widget bar.

**Bug Fixes**

- **Fixed a bug in the Market Status pop-up.** [Corrections](https://www.tradingview.com/charting-library-docs/latest/connecting_data/time-and-sessions/Extended-Sessions#corrections-for-extended-sessions) specified for the extended session in the [`session-correction`](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.LibrarySubsessionInfo#session-correction) properties were not displayed in the _Market Status_ pop-up window.

## Version 27.004

*Date: Wed Apr 17 2024*

**Breaking Changes**

- **Fixed time parameters in CrossHairMovedEventParams.** In version 26.001, we changed the `time` property of [`CrossHairMovedEventParams`](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.CrossHairMovedEventParams) to be a timestamp in the selected time zone.
In this version, we reverted that change, and `time` represents a UTC timestamp again. Additionally, we introduced a new [`userTime`](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.CrossHairMovedEventParams#usertime) property that represents a timestamp in the selected time zone.

**Improvements**

- **Added ability to disable pulse animation when chart type is set to Line.** New _disable_pulse_animation_ featureset allows users to disable the pulse animation when chart type is set to Line.

**Bug Fixes**

- **Fixed the price scale placement.** The [price scale](https://www.tradingview.com/charting-library-docs/latest/ui_elements/Price-Scale) should be placed back to its original position when a change made through the _Settings_ dialog is canceled. Fixes [#4991](https://github.com/tradingview/charting_library/issues/4991)
- **Fixed the 52 Week High/Low indicator issue.** The 52 Week High/Low indicator no longer adds an empty space to the price scale when less than 52 weeks of historic bars are available. Fixes [#8137](https://github.com/tradingview/charting_library/issues/8137) [#8469](https://github.com/tradingview/charting_library/issues/8469)
- **Only calculate VWAP value when entire anchor period is loaded.** The VWAP indicator will only calculate values for the input anchor period if all bars in that period have been loaded.
- **Fixed a trailing stop modification dialog error.** Fixed a problem where opening the Order Ticket for a trailing stop position caused a "ReferenceError: isPositionLikeItem is not defined" error to be thrown.
- **Fixed the incorrect point position for the Long Position drawing.** The `getPositionPoints()` method will now return correct point positions. Fixes [#8230](https://github.com/tradingview/charting_library/issues/8230)
- **`BREAKING CHANGE` Position line price label does not use the correct price formatter.** The price scale will now correctly reflect the value when a formatter is used with [`createPositionLine`](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.IChartWidgetApi#createpositionline).
Both [`createOrderLine`](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.IChartWidgetApi#createorderline) and [`createPositionLine`](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.IChartWidgetApi#createpositionline) methods behave similarly to the corresponding actions made in the UI via [Order Ticket](https://www.tradingview.com/charting-library-docs/latest/trading_terminal/order-ticket).
Fixes [#8413](https://github.com/tradingview/charting_library/issues/8413) [#8324](https://github.com/tradingview/charting_library/issues/8324)

**Documentation**

- **New User accounts article.** Refer to [User accounts](https://www.tradingview.com/charting-library-docs/latest/trading_terminal/account-manager/user-accounts) for information on how to manage user accounts in the [Account Manager](https://www.tradingview.com/charting-library-docs/latest/trading_terminal/account-manager).
- **Session documentation updates.** The [Symbology](https://www.tradingview.com/charting-library-docs/latest/connecting_data/Symbology#session) and [Extended sessions](https://www.tradingview.com/charting-library-docs/latest/connecting_data/time-and-sessions/Extended-Sessions) articles now include more information on how to specify sessions and corrections for them.
- **New Save user settings article.** Refer to the [Save user settings](https://www.tradingview.com/charting-library-docs/latest/saving_loading/user-settings) article for information on how to store user settings.
- **Updated Watchlist article.** Explore our latest [Watchlist](https://www.tradingview.com/charting-library-docs/latest/trading_terminal/Watch-List) article that describes how to customize and handle the watchlist's data.

## Version 27.003

*Date: Thu Mar 14 2024*

**Improvements**

- **Added the resetLayoutSizes method.** Use [`resetLayoutSizes`](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.IChartingLibraryWidget#resetlayoutsizes) to reset the sizes of all charts within a multiple-chart layout back to their initial default values. `Trading Platform Only`
- **Added the unloadUnusedCharts method.** The [`unloadUnusedCharts`](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.IChartingLibraryWidget#unloadunusedcharts) method deletes non-visible charts from a multiple-chart layout. Use this method to
prevent the library's inherent behavior to restore previously displayed charts instead of creating new
charts when changing layouts. `Trading Platform Only`
- **Added a new type that reflects the ID of the created indicator.** A new [`study_event`](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.SubscribeEventsMap.md#study_event) type was added: `create`. It returns the `id` of the newly created indicator.

**Bug Fixes**

- **Displaying volume indicator on chart load when visible_plots_set is not specified.** The chart will now correctly display the volume indicator if the `create_volume_indicator_by_default` featureset is enabled even if the symbols [LibrarySymbolInfo](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.LibrarySymbolInfo) doesn't specify the optional [`visible_plots_set`](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.LibrarySymbolInfo#visible_plots_set) property.
- **Prioritise widget constructor symbol over saved state.** The [`symbol`](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.ChartingLibraryWidgetOptions#symbol) property in the widget constructor will now have priority over symbols loaded from saved chart states when using [`saved_data`](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.ChartingLibraryWidgetOptions#saved_data) or [`load_last_chart`](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.ChartingLibraryWidgetOptions#load_last_chart). Fixes [#7922](https://github.com/tradingview/charting_library/issues/7922) [#8473](https://github.com/tradingview/charting_library/issues/8473) [#7926](https://github.com/tradingview/charting_library/issues/7926) [#8168](https://github.com/tradingview/charting_library/issues/8168)
- **Fixed an issue where the time_frames description was ignored.**

## Version 27.002

*Date: Thu Feb 22 2024*

**Improvements**

- **Add positive and negative filled areas to Spread.** The Spread indicator now has a positive and negative filled area above and below the baseline value of 0. The colors of the filled areas are green and red respectively.

**Bug Fixes**

- **Brush drawing_event is now raising a `create` event when starting drawing.**

**Documentation**

- **Improved drawing documentation.** Explore our latest articles about drawings.
  - New [Drawings API](https://www.tradingview.com/charting-library-docs/latest/ui_elements/drawings/drawings-api) article describes how to manage drawings in the code.
  - Updated [Drawing Overrides](https://www.tradingview.com/charting-library-docs/latest/customization/overrides/Drawings-Overrides) article now includes more information on how to customize drawings.

## Version 27.001

*Date: Fri Feb 2 2024*

**Improvements**

- **Custom indicators can now dynamically hide indicator inputs in the legend when plots are hidden.** The `hideWhenPlotsHidden` option has been added for a custom indicator's input. It enables you to hide an input's value in the legend text when the user hides all of the specified plots.

**Bug Fixes**

- **Allow studies that extend the time scale to load historic bars before the leftmost bar of the main series.**

**Documentation**

- **New articles**
  - [Context menu](https://www.tradingview.com/charting-library-docs/latest/ui_elements/context-menu)
  - [Orders](https://www.tradingview.com/charting-library-docs/latest/trading_terminal/trading-concepts/orders)
  - [Snapshots](https://www.tradingview.com/charting-library-docs/latest/ui_elements/Snapshots)

## Version 27

*Date: Wed Jan 17 2024*

**Breaking Changes**

- **Custom study plot style text property moved.** The chars and shapes custom study plots `text` style property was moved from `metainfo.defaults.styles.[plot id].text` to `metainfo.styles.[plot id].text`. See this GitHub issue for more details [#8184](https://github.com/tradingview/charting_library/issues/8184)
- **Changed context menu behavior of the 'Plus' button and removed the 'show_context_menu_in_crosshair_if_only_one_item' featureset.** Now, the context menu of the *Plus* button opens even if the menu has only one item. Previously, the item's action was immediately executed if there was only one item in the context menu. Additionally, the `show_context_menu_in_crosshair_if_only_one_item` featureset has been removed.

**Breaking Changes: Trading Platform**

- **Changed parameter type in the showPositionDialog method.** The `position` parameter type of the [`showPositionDialog`](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.BrokerCustomUI#showpositiondialog) method in the [`BrokerCustomUI`](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.BrokerCustomUI) interface has been changed to `Position | IndividualPosition`.
- **Renamed flags in the BrokerConfigFlags interface.** The following flags have been renamed in the [`BrokerConfigFlags`](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.BrokerConfigFlags) interface:
  - `supportTrades` flag has been renamed to `supportPositionNetting`;
  - `supportTradeBrackets` flag has been renamed to `supportIndividualPositionBrackets`;
  - `supportCloseTrade` flag has been renamed to `supportCloseIndividualPosition`;
  - `supportPartialCloseTrade` flag has been renamed to `supportPartialCloseIndividualPosition`;
  - `requiresFIFOCloseTrades` flag has been renamed to `requiresFIFOCloseIndividualPositions`.
- **Renamed TradeBase and Trade interfaces.** The `TradeBase` interface has been renamed to [`IndividualPositionBase`](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.IndividualPositionBase) and the `Trade` interface has been renamed to  [`IndividualPosition`](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.IndividualPosition) respectfully.
All fields and their types has been left unchanged.
- **Renamed tradeColumns field in the AccountManagerInfo interface.** The `tradesColumns` field in the [AccountManagerInfo](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Broker.AccountManagerInfo) interface has been renamed to `individualPositionColumns`.
- **Renamed Trade member to IndividualPosition in the ParentType enum.** The `Trade` member of the [`ParentType`](https://www.tradingview.com/charting-library-docs/latest/api/enums/Charting_Library.ParentType) enum has been renamed to `IndividualPosition`.
- **Renamed trade related methods in the IBrokerConnectionAdapterHost interface.** The following methods in the [`IBrokerConnectionAdapterHost`](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.IBrokerConnectionAdapterHost) have been changed:
  - the `tradeUpdate` method has been renamed to [`individualPositionUpdate`](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.IBrokerConnectionAdapterHost#individualpositionupdate). The `trade` parameter of the method has been renamed to `individualPosition`. Also, the type of that parameter has been changed to `IndividualPosition`;
  - the `tradePartialUpdate` method has been renamed to [`individualPositionPartialUpdate`](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.IBrokerConnectionAdapterHost#individualpositionpartialupdate). The type of the `changes` parameter has been changed to `Partial<IndividualPosition>`;
  - the `tradePLUpdate` method has been renamed to [`individualPositionPLUpdate`](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.IBrokerConnectionAdapterHost#individualpositionplupdate);
  - the type of the `position` parameter of the [`showPositionBracketsDialog`](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.IBrokerConnectionAdapterHost#showpositionbracketsdialog) method has been changed to `Position | IndividualPosition`.
- **Renamed methods in the IBrokerWithoutRealtime interface.** The following changes have been made in the [`IBrokerWithoutRealtime`](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.IBrokerWithoutRealtime) interface:
  - The `closeTrade` method has been renamed to `closeIndividualPosition`;
  - The `editTradeBrackets` method has been renamed to `editIndividualPositionBrackets`.
- **Renamed trade method in the IBrokerCommon interface.** The `trades` method in the [`IBrokerCommon`](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.IBrokerCommon) has been renamed to `individualPositions`. The return type of that method has been changed to `Promise<IndividualPosition[]>`.
- **Removed the Order Panel button from the right toolbar.** To open [_Advanced Order Ticket_](https://www.tradingview.com/charting-library-docs/latest/trading_terminal#advanced-order-ticket), users should use the _Trade_ button in _Account Manager_ now.

**New Features**

- **Enabled in-place editing in Legend.** Users can change a symbol and resolution right from the [_Legend_](https://www.tradingview.com/charting-library-docs/latest/ui_elements/Legend) now. [#7966](https://github.com/tradingview/charting_library/issues/7966)
- **Added Quick Search.** The _Quick Search_ dialog allows users to search for drawings, UI settings, and functions, such as _Remove Indicators_.
To open this dialog, users should click the _Quick Search_ button on the top toolbar or use the _Ctrl/Cmd_ + _K_ shortcut.
- **Added ability to show daily change in the chart legend.** New _Last day change values_ option allows users to show/hide the last day change values in the main series legend.
To make this option available in the _Chart Settings_ dialog, use the [`legend_last_day_change`](https://www.tradingview.com/charting-library-docs/latest/customization/Featuresets#legend_last_day_change) featureset. [#8193](https://github.com/tradingview/charting_library/issues/8193)
- **Updated drawing icons.** New icons for the _Text_, _Anchored Text_, _Note_, and _Anchored Note_ drawings. [#8181](https://github.com/tradingview/charting_library/issues/8181)

**Improvements**

- **`BREAKING CHANGE` Refactoring of the Ichimoku Cloud indicator.** Following feedback we've re-written the Ichimoku indicator and have brought the following changes:
  - 'Leading Span B' input is now 'Leading Span Periods'.
  - 'Lagging Span' input is now 'Lagging Span Periods'.
  - 'Leading Shift Periods' is a brand new input that aligns better to the original definition of the indicator.
  - Previously, 'Lagging span' was shifting both cloud and lagging lines. This should no longer apply as 'Leading Shift Periods' now handles the offset change for 'Lagging Span'.
- **`BREAKING CHANGE` Inputs renaming for Stochastic indicator.** Inputs for the Stochastic indicator have been renamed for consistency across our products.
- **`BREAKING CHANGE` Broker API clean up.** `Trading Platform Only` The `positionDialogOptions` object has been removed from the Broker's Configuration. Please use the `getPositionDialogOptions` method to customize the Position dialog.
- **Added new keyboard navigation shortcut.** Starting from version [26.002](https://www.tradingview.com/charting-library-docs/latest/releases/release-notes#version-26002), the library supports a keyboard navigation activated via the _Alt/Opt_ + _Z_ shortcut. Now, you can change this default navigation shortcut to _Tab_. To do this, enable the new  [`accessible_keyboard_shortcuts`](https://www.tradingview.com/charting-library-docs/latest/customization/Featuresets#accessible_keyboard_shortcuts) featureset. For more information, refer to [Keyboard navigation](https://www.tradingview.com/charting-library-docs/latest/configuration/accessibility#keyboard-navigation).
- **Added ability to cancel order dragging by pressing Esc.** If a user presses _Esc_ while dragging the order, the order will be returned to its initial position.

**Bug Fixes**

- **Market status text during pre-market and post-market sessions.** The countdown text in the market status pop-up tooltip (in the legend area) has been fixed for pre-market and post-market sessions. The market status icon now shows an orange sunrise icon for pre-market and a blue moon icon for post-market.
- **Floating drawing toolbar context menu.** It wasn't possibly to override the context menu for the floating drawing toolbar.
- **Missing translation for No data here.** No data here message that is displayed on the chart whenever no bars are returned for a given symbol was missing its translation.
- **Disabling the 'open_account_manager' featureset now works as expected.** `Trading Platform Only`
- **Order Panel Custom Input Fields Reactivity.** `Trading Platform Only` The reactivity of UI elements within the order panel when using custom fields has been improved (Fixes [#6607](https://github.com/tradingview/charting_library/issues/6607)).
- **Fixed the pane buttons on the collapsed pane.** The pane buttons used to overlap the _Scroll to the Most Recent Bar_ button when the pane is collapsed. [#8213](https://github.com/tradingview/charting_library/issues/8213)
- **The precision setting can be applied to all charts now.** To do this, users should specify precision in the _Chart settings_ dialog and click the _Apply to all_ button. [#8343](https://github.com/tradingview/charting_library/issues/8343) `Trading Platform Only`
- **Fix the color of high/low price label.** Now, the color of high/low labels on the price scale corresponds to the color of the high/low lines. Users can specify this color in the _Chart settings_ dialog. [#8255](https://github.com/tradingview/charting_library/issues/8255)

**Documentation**

- **Chart customization precedence article added.** The library offers multiple approaches for changing the chart appearance and behavior.
Explore our latest article on [customization precedence](https://www.tradingview.com/charting-library-docs/latest/customization/customization-precedence)
for a comprehensive understanding of customization methods/properties and the sequence in which they are applied.
- **Order Ticket dialog article added.** Refer to [Order Ticket](https://www.tradingview.com/charting-library-docs/latest/trading_terminal/order-ticket) to learn how to provide custom fields, enable an order preview, implement your custom Order Ticket, and more.
- **New how-to guide on metainfo.** Explore our latest [guide](https://www.tradingview.com/charting-library-docs/latest/tutorials/how-to-guides/create-custom-indicator/metainfo-implementation) on how to implement the `metainfo` field when you create a custom indicator. For more information about custom indicators and `metainfo`, refer to the updated [Custom indicators](https://www.tradingview.com/charting-library-docs/latest/custom_studies) and [Metainfo](https://www.tradingview.com/charting-library-docs/latest/custom_studies/metainfo) articles.
- **Bracket orders article added.** Explore our latest article on [bracket orders](https://www.tradingview.com/charting-library-docs/latest/trading_terminal/trading-concepts/brackets) in Trading Platform.
- **Account Manager article added.** Refer to [Account Manager](https://www.tradingview.com/charting-library-docs/latest/trading_terminal/account-manager) for more information on creating pages, customizing columns, and configuring the Account Manager behavior.
- **Accessibility article added.** Refer to the new [Accessibility](https://www.tradingview.com/charting-library-docs/latest/configuration/accessibility) article for information about accessibility features that the library includes.
- **Other documentation updates.** The new documentation version includes:
  - Updated [Resolution](https://www.tradingview.com/charting-library-docs/latest/ui_elements/Resolution) and [Price Scale](https://www.tradingview.com/charting-library-docs/latest/ui_elements/Price-Scale) articles.
  - A full list of overrides for built-in indicators. Refer to the [Indicator Overrides](https://www.tradingview.com/charting-library-docs/latest/customization/overrides/indicator-overrides#list-of-overrides) article for information.

**Other**

- **`BREAKING CHANGE` Deprecated customFormatters and brokerFactory.** Use [`custom_formatters`](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.ChartingLibraryWidgetOptions#custom_formatters)
and [`broker_factory`](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.TradingTerminalWidgetOptions#broker_factory) instead.
- **`BREAKING CHANGE` Deprecated RawStudyMetaInfo.precision.** Use the [`format`](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.RawStudyMetaInfo#format) property instead. For more information, refer to the [Metainfo](https://www.tradingview.com/charting-library-docs/latest/custom_studies/metainfo) article.

## Version 26.004

*Date: Thu Nov 16 2023*

**New Features**

- **Add methods to handle trading quantity.** The broker API now exposes a getter [getQty](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.IBrokerConnectionAdapterHost#getqty) and a setter [setQty](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.IBrokerConnectionAdapterHost#setqty) along with a subscription [subscribeSuggestedQtyChange](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.IBrokerConnectionAdapterHost#subscribesuggestedqtychange) and its dependant to unsubscribe [unsubscribeSuggestedQtyChange](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.IBrokerConnectionAdapterHost#unsubscribesuggestedqtychange).

**Improvements**

- **Added anchor option to VWAP indicator.** The VWAP indicator now has input options for source and anchor.
  - Source allows customisation of the price source for the indicator. Defaults to `hlc3`.
  - Anchor period setting specifies how frequently the VWAP calculation will be reset. This  Defaults to `'Session'`.

**Bug Fixes**

- **VWAP Indicator behaviour.** The default behaviour for the VWAP indicator has been fixed. Previously it would anchor to the earliest available data point instead of the start of each session.
- **Displaying DOM widget data on non-tradable symbols.** `Trading Platform Only` When a symbol is non-tradable (`isTradable()` in the Broker API is returning `false`) it is now possible to display depth data in the DOM widget provided via the datafeed.
- **The price source text is visible in the screenshot.**
- **Fix display of price sources in Overlay study.** Price sources for symbols in the Overlay study were not being shown when the main series symbol did not have the same price source
- **Both Trend Strength Index and Linear Regression Slope indicators were missing their zero-based property to properly plot them using a histogram.**
- **onChartReady inconsistency on Safari.** Fixed an issue where `onChartReady` wouldn't reliably get called on specific versions of Safari.

**Documentation**

- **New article on core trading concepts.** We have added a new article describing [trading concepts](https://www.tradingview.com/charting-library-docs/latest/trading_terminal/trading-concepts) in Trading Platform.
Learn how to integrate trading functionality into your application using the Broker API and Trading Host.

## Version 26.003

*Date: Thu Oct 05 2023*

**Bug Fixes**

- **Do not save to localstorage when the use_localstorage_for_settings feature is disabled.** Fixed a bug where use_localstorage_for_settings did not stop some settings from being saved to localstorage.
- **Disabling `drawing_templates` completely removes the ability to save it when using line tools.**
- **Renaming a section within watchlist was throwing an error.**
- **Fixed an issue where it wasn't possible to set the background colour of a Renko bar to transparent.**

## Version 26.002

*Date: Mon Sep 18 2023*

**Improvements**

- **IOrderLineAdapter and IPositionLineAdapter now support positioning with pixel units.** The
[setLineLength](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.IOrderLineAdapter#setlinelength)
method in the IOrderLineAdapter (returned by
[createOrderLine](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.IChartWidgetApi#createorderline))
and IPositionLineAdapter
([createPositionLine](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.IChartWidgetApi#createpositionline))
interfaces now support setting the unit to `'pixel'`.
  - Additionally, when using pixel unit, you can specify a negative number to
  position from the left edge of the chart instead.
- **Added keyboard navigation.** Keyboard navigation (activated via alt/opt + z keyboard shortcut) and many other accessibility improvements have been added to the library.
  - A featureset `accessibility` (on by default) has been added to control this behaviour.
- **Menu name is provided to items_processor (context menu API).** [items_processor](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.ContextMenuOptions#items_processor) within the [context_menu](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.ChartingLibraryWidgetOptions#context_menu) API now includes details about the name of menu, and the ids of the related item (such as the series, drawing, study, order, or position).
- **Support more kinds of extended sessions.** The library now supports specifying only one of the postmarket or premarket sessions without the other.

**Bug Fixes**

- **On mobile devices, fixed an issue for when scrolling the pricescale with one finger while another one was holding the crosshair.**
- **Fixed an issue where it wasn't possible to set the background colour of a candle to transparent.**
- **52 Week High/Low indicator compatibility with empty supported_resolutions array.** Fixes [#7884](https://github.com/tradingview/charting_library/issues/7884) issue.
- **Fixed an issue where any added indicator on the chart couldn't be undone.**
- **Fixed issue with locking visible time range while resizing chart.** When resizing the chart window with percentage right margin, and the `lock_visible_time_range_on_resize` featureset enabled then the visible range wasn't locked correctly.
- **SuperTrend Indicator Starting Point.** The SuperTrend would previously start drawing from zero for the first bar, instead of only drawing the indicator after the initial length (defined in the indicator's inputs) when all the possible data for a symbol has been loaded.
- **Changing the LineStyle for a position is again available.**
- **Styles tab for Pivot Point Standard indicator.** Resolved an issue where the style tab for the Pivot Point Standard indicator would not function correctly when the type option was set to 'Floor'.

**Other**

- **Custom Translation Function.** The following changes have been made to the [custom_translate_function](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.ChartingLibraryWidgetOptions#custom_translate_function)
  - The interface name for the options has changed from `TranslateOptions` to `CustomTranslateOptions`.
  - The `plural` field in `CustomTranslateOptions` can now be either a single string, or an array of strings.
  - A third boolean argument is now provided. When this is true then the key provided is already translated.

## Version 26.001

*Date: Tue Aug 08 2023*

**New Features**

- **Add series and study values to crosshair move event.** The [`crossHairMoved` subscription](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.IChartWidgetApi/#crosshairmoved) now exposes the study and series values in the event object. The values are the same as the values shown in the data window.
- **Adding a new Floor type for calculating Pivot.**
- **Add the onHoveredSourceChanged method to the widget API.** See [`onHoveredSourceChanged`](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.IChartWidgetApi/#onhoveredsourcechanged).

**Improvements**

- **Added optional variable_tick_size property to symbol info.**
- **Added onMoving to the Order Line Adapter.** [onMoving](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.IOrderLineAdapter#onmoving)

**Bug Fixes**

- **Selecting an incorrect symbol within a study no longer prevents the study from recovering when a valid symbol is chosen later.**
- **Fix drawing tools not affecting undo/redo stack and chart layout saving buttons.** Drawing actions can now be undone/redone and will affect the saving of the chart layout
- **Disabling the 'open_account_manager' featureset now works as expected.**

**Other**

- **Watchlist sections featureset added for adjusting the visibility of the 'Add Section' button.** The UI for creating watchlist sections can now be hidden by disabling the [watchlist_sections](https://www.tradingview.com/charting-library-docs/latest/customization/Featuresets#watchlist_sections) featureset.

## Version 26

*Date: Tue Jul 18 2023*

**Breaking Changes**

- **Remove Lines item and submenu from background and symbol context menu.** The "lines" item has been removed from the context menu of the chart and the legend of the main series.

**New Features**

- **In bottom toolbar, tooltip text for date ranges has changed.** Hovering over the time frame buttons will provide more details to understand how chart is constructed.
- **Add setting for visibility of A (auto) and L (log) scale buttons.** In Chart settings, Scale tab, a new setting has been introduced to enable shortcuts for Auto & Logarithmic modes.
- **Bug in compare data displayed in Data window.** There was an issue where OHLC values would only be displayed in the data window widget when using the cross hair selection instead of displaying the data from the latest available bar if nothing was selected. Fixes [#7769](https://github.com/tradingview/charting_library/issues/7769)
- **Update chart maximization icon and remove animation.** Maximization button restyled
- **Price scale resizing while scrolling chart in mobile browser.** When scrolling into history the price scale expands to accommodate the values, but doesn't retract when the values become shorter. This is done to make the scale less twitchy during scrolling. The scale's width is reset on data loading.

**Improvements**

- **Fixed a bug where on some DPR there was no separator between the right widget panel and the order panel.** Now the separator line is always visible.
- **No bracket settings in chart settings.** Bracket settings were added to the Chart settings in the Trading tab.
- **Symbol logos within the Legend and Account Manager.** Symbol logos can now be displayed within the [Legend](https://www.tradingview.com/charting-library-docs/latest/ui_elements/Legend#symbol-logos) and the Account Manager panel (`Trading Platform Only`) if the `show_symbol_logos` featureset is enabled.
  - `show_symbol_logo_in_legend` featureset can be disabled to hide the logos within the legend.
  - `show_symbol_logo_for_compare_studies` featureset can be disabled to hide the logos within the legend for compare overlay studies.
  - `show_symbol_logo_in_account_manager` featureset can be disabled to hide the logos within the Account Manager panel (`Trading Platform Only`).
- **Added setter and getter methods for CSS custom properties defined within the iframe.** The widget API now includes [setCSSCustomProperty](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.IChartingLibraryWidget#setcsscustomproperty) and [getCSSCustomPropertyValue](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.IChartingLibraryWidget#getcsscustompropertyvalue) methods for controlling CSS custom properties within the chart's iframe element.

**Other**

- **Deprecated properties and methods.** The following properties and methods are marked as deprecated and will be removed in the next major release:
  - `customFormatters` in the [ChartingLibraryWidgetOptions](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.ChartingLibraryWidgetOptions) interface. Use [`custom_formatters`](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.ChartingLibraryWidgetOptions/#custom_formatters) instead.
  - `customFormatters` and `brokerFactory` in the [TradingTerminalWidgetOptions](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.TradingTerminalWidgetOptions) interface. Use [`custom_formatters`](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.TradingTerminalWidgetOptions/#custom_formatters) and [`broker_factory`](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.TradingTerminalWidgetOptions/#broker_factory) instead.

## Version 25.002

*Date: Wed Jul 12 2023*

**New Features**

- **Add 52 Week High/Low study.**
- **Enable hiding price scales when all studies or series are hidden.** Adds the `hide_price_scale_if_all_sources_hidden` feature. When enabled price scales will be hidden when all studies (or the main series) attached to the price scale are hidden.
- **Option to always show legend values for studies on mobile.** By default, when on mobile, the legend won't display any values for studies.
Enabling this new `always_show_legend_values_on_mobile` featureset allows you to display the values.

**Improvements**

- **Sections can now be added within the Watchlist.** Sections dividers can now be added within the watchlist (`Trading Platform Only`).
  - Any item within a list which is prefixed with `###` will be considered a section divider. [API Reference](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.IChartingLibraryWidget#watchlist)
- **Symbol and exchange logos can now be shown within the Compare Dialog.** The [symbol info](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.LibrarySymbolInfo) provided by [resolveSymbol](https://www.tradingview.com/charting-library-docs/latest/connecting_data/datafeed-api/required-methods#resolvesymbol) should now include 'exchange_logo' if you would like to use the 'show_exchange_logos' featureset.

**Bug Fixes**

- **Watermark API's content provider is now used for all charts within a multi-chart layout.**
- **Fixed issue with resetData.** When resetting the data for a chart, any existing studies would become unlinked from the data source. Fixes [#7802](https://github.com/tradingview/charting_library/issues/7802)
  - The `request_only_visible_range_on_reset` featureset now defaults to `disabled`.

## Version 25.001

*Date: Mon Jun 26 2023*

**Breaking Changes**

- **price_sources moved to symbol info.** To allow price sources resolved on-demand with the associated symbol the `price_sources` property has been removed from [the datafeed configuration object](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.DatafeedConfiguration) and added to the [symbol info object](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.LibrarySymbolInfo).

**New Features**

- **Added Market status state getter.** [marketStatus](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.IChartWidgetApi#marketstatus) method is provided within [IChartWidgetApi](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.IChartWidgetApi) which returns a watched value of the charts symbols current [market status](https://www.tradingview.com/charting-library-docs/latest/api/enums/Charting_Library.MarketStatus).
- **Symbol and exchange logos.** It is now possible to specify logo images for symbols and exchanges. These will be visible within the search dialog, and watchlist (Trading Platform). The `show_symbol_logos` and `show_exchange_logos` featuresets should be enabled, and your datafeed should be updated to provide urls as part of the symbol info supplied by the `resolveSymbol` method, and results supplied by the `searchSymbols` method.
- **Enable custom studies to extend the time scale.** Enable custom studies to extend the time scale with points that don't exist in the main series.
  - [See this article for more info](https://www.tradingview.com/charting-library-docs/latest/custom_studies/Studies-Extending-The-Time-Scale)
- **Added Custom Symbol Status API.** The new [Custom Symbol Status API](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.ICustomSymbolStatusApi) enables the creation and customisation of an additional status to be displayed for the symbol within the legend area.
  - The Custom Symbol Status API can be accessed via the [`customSymbolStatus`](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.IChartingLibraryWidget#customsymbolstatus) method on the chart widget.
  - An example is provided on the [Symbol Status](https://www.tradingview.com/charting-library-docs/latest/ui_elements/Symbol-Status) page.
- **Featureset added for clearing the price scale on errors.** Added new `clear_price_scale_on_error_or_empty_bars` featureset to automatically clear pane price scales when the main series has an error or has no bars.
- **Adding Anchored VWAP in Trend line tools.** A new Trend line tool has been added to the already long list: Anchored VWAP.

**Improvements**

- **Added Watermark API.** The new [Watermark API](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.IWatermarkApi) enables the customisation of the watermark text in addition to providing [WatchedValues](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.IWatchedValue) for the color and visibility properties.
  - The Watermark API can be accessed via the [`watermark`](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.IChartingLibraryWidget#watermark) method on the chart widget.
- **Updated broker API sample to support bracket orders.** The sample broker API has been updated to support brackets (stop loss, and take profit) orders. `Trading Platform Only`
- **Drawings in saved charts now restore with the saved settings for lock and disableSelection.** The `lock` and `disableSelection` settings for a created shape will now be saved and restored correctly. [#6761](https://github.com/tradingview/charting_library/issues/6761)
- **Fullscreen button can now be used to exit fullscreen mode as well.** When using the `header_in_fullscreen_mode` featureset, it is now possible to use the fullscreen button to exit fullscreen mode.
- **Added method to programmatically set the time frame for the active chart.** The [setTimeFrame](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.IChartWidgetApi#settimeframe) method has been added to the widget which can set the time frame in a similar manner to the [Timeframes at the bottom of the chart](https://www.tradingview.com/charting-library-docs/latest/ui_elements/Time-Scale#timeframes-at-the-bottom-of-the-chart) buttons.
- **Renaming precision dropdown values in Chart settings.** To limit confusion when dealing with the Chart settings/Precision dropdown values, some fractional ones have been renamed to more readable ones.
- **Changing Source option in line-break & renko chart.** In Trading Platform, it was unnecessary to offer the option to change the source of data for both Renko and Line Break, as the data is taken from the close value.

**Bug Fixes**

- **Timescale marks will adjust correctly when widget theme is changed.**
- **onAutoSaveNeeded event emitted when removing all drawings via toolbar button.**
- **removeChart within the save load adapter will await the promise before updating the UI.**
- **First getBars request after resetting data no longer has a countback of zero.**
- **Market status pop up text could sometimes display Infinity or NaN values and not update on the dot.**
- **Fix custom field validators.** Fixes a bug where custom broker field validator functions were not called if provided.
- **Fixed rendering on price and time axes when a Trend Angle line drawing is selected.**

**Other**

- **Changed validation warning message within the close position UI.** Message changed from 'Specified value is more than the instrument maximum' to 'The amount entered exceeds the position size'.
- **Corrected the strings for the ThemeName type definition.** The possible values should have been lowercase: 'dark' & 'light'.
- **Moved Session breaks from Events to Appearance tab in chart options.** This reverts a breaking change made in `v25.0`.
- **Adding snippets for Trading Platform datafeed methods.** Some functions were lacking an out of the box snippet to use within their application.

## Version 25

*Date: Mon May 22 2023*

**Breaking Changes**

- **Save and Load Chart Templates.** Add methods to the [save/load adapter](https://www.tradingview.com/charting-library-docs/latest/saving_loading) to support chart templates.
- **Renew design for send order and buy sell buttons.** Renew design for send order and buy sell buttons:
  - Buttons are now rounded
  - Selected item and underline are now black
- **New TV logo.** What is changing:
  - Changing the size, boldness of the text
  - Indentation of the logo from the borders of the chart
- **One row for grid lines settings.** The grid lines settings have been combined into one row.
- **Remove magnet icon near cursor - Reverting feature.** Following reviews this piece of work was reverted.
- **Update Advanced Charts branding.** Branding font and position is slightly changed.
- **Do not load Euclid font for the branding logo on chart.** The Euclid font will not load if there is an animated logo on the chart.
- **When the chart data is reset, the new request for data will only be for the visible range.** The previous behavior was that when [resetData](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.IChartWidgetApi#resetdata) was evoked, that the datafeed would be requested to provide data for the entire range of data already loaded for that symbol. The new behavior is that the request is now only for the current visible range. This more closely matches the behavior of the first load. If you require the old behavior then you can disable the `request_only_visible_range_on_reset` featureset.
- **Remove timezone & session breaks section from scale gear menu.** Time zone and Session breaks section has been removed from gear menu.
- **Update chart types icons.** Changed icons for Line, Area and Baseline chart types.
- ~~**Move Session breaks from Appearance to Events tab.** Session breaks setting is moved to events tab.~~ (Reverted in v25.001)
- **Changed the gear icon.** Changed the icon for price scale settings button ('gear' in bottom-right corner). See [#7666](https://github.com/tradingview/charting_library/issues/7666)
- **Chart navigation buttons.** Navigation buttons at the bottom of the chart have a slightly new design.

**New Features**

- **Adding a new chart type HLC Area.** HLC Area is a new chart type available.
- **Handle variable-tick-size.** Added support for variable tick size.
- **Add new stats position for info line drawing "auto".** Option of automatic positioning of information block for infoline drawings was added "auto" (in addition to existing left, center, right).
- **Add new checkboxes for price range in Info Line drawing box.** Added 2 settings in linetools context menu:
  - Percent change
  - Change in pips
- **Add ability to move anchors continuously - not by bars.** Smooth resizing of icons, stickers and emojis was implemented.
- **Correct Chart settings text Price scale labels.** "LABELS" group in "Scales" tab of Chart settings has been renamed to "LABELS ON PRICE SCALE".
- **Show + button on cursor by hotkey.** Added hotkeys Alt+Ctrl (win) or Opt+Command (mac) for the appearance of the plus button under the cursor.
- **Add Data window item to context/legend three dots menu.** Added new item to context/legend three dots menu - "Data window..." with a shortcut. Opens Data Window in the right panel.
- **Add Volume profile indicators on the top of chart series.** Changed the default z-order for Volume Profile indicators and VP drawings. They are now located above the main series.
- **Added new time zone Anchorage Alaska.** Added new time zone Anchorage Alaska (UTC-9).
- **Separate chart types Line with markers and Stepline.** Step line and Line with markers types are added to the top toolbar chart types menu.
- **Added new time zone Casablanca.** Timezone Casablanca (UTC) has been added.
- **Try to load line tools code dynamically.** Fixed floating toolbar for Price Note to show color and text settings like for other drawings.
- **Add sticker drawing tool.** Add the ability to use stickers with `createMultipointShape` or `selectLineTool`.
- **Add Accelerator Oscillator indicator.**

**Improvements**

- **Theming support for pop-up menus.** Additional CSS custom properties have been added for styling pop-up menus. Pop-up (as known as 'pop-over') menus include toolbar menus, and context menus. See the full list of CSS custom properties in the [CSS Color Themes](https://www.tradingview.com/charting-library-docs/latest/customization/styles/CSS-Color-Themes) article.
- **Add date and time input UI for custom studies.** [Custom studies](https://www.tradingview.com/charting-library-docs/latest/custom_studies) now support defining inputs of the `'time'` type and having a GUI element (date and time pickers) in the indicators settings dialog window.
- **setActiveChart added to the Widget API.** The currently active chart in a multi-chart layout (available on Trading Platform only) can now be changed using the `setActiveChart` method. [more info](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.IChartingLibraryWidget#setactivechart)

**Bug Fixes**

- **Include missing PriceAxisLastValueMode and LineStyle enums in type documentation.**

**Documentation**

- **The Overrides article update.** We have updated the [Overrides](https://www.tradingview.com/charting-library-docs/latest/customization/overrides) article. Now it contains general information about the Overrides API. For information on how to customize elements on the chart, refer to a new [Chart Overrides](https://www.tradingview.com/charting-library-docs/latest/customization/overrides/chart-overrides) article.

## Version 24.004

*Date: Mon Apr 24 2023*

**New Features**

- **Indicators can now be favorited.** Indicators can now be favorited by tapping on the star icon to the left of the
indicator name. Favorited indicators will appear at the top of the indicator
list.
  - The `items_favoriting` featureset should be enabled. [more info](https://www.tradingview.com/charting-library-docs/latest/customization/Featuresets)
- **Adding two featuresets to hide the right_toolbar or its tabs.** There are 2 new featuresets `hide_right_toolbar` & `hide_right_toolbar_tabs` plus an additional WidgetBar API [changeWidgetBarVisibility](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.IWidgetbarApi#changewidgetbarvisibility) to control the right toolbar.
  - `hide_right_toolbar` allows you to instantiate the toolbar without showing it in the UI.
  - `hide_right_toolbar_tabs` will do the same with the exception of not showing tabs when displaying the right toolbar.

**Improvements**

- **Added a middle band for the RSI indicator.** Unlike on tradingview.com RSI was not presenting the option to plot a middle limit.
- **Indicators favorites can now be defined within widget constructor.** Indicators can now be defined as favorites using the [`favorites`](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.ChartingLibraryWidgetOptions#favorites) property of the widget constructor options. See [Favorites.indicators](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.Favorites#indicators) for more information.
- **Add a way to independently clear bar marks/timescale marks.** [`clearMarks`](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.IChartWidgetApi#clearmarks) method has been enhanced to pass in an option to choose which marks should be cleared on the chart.
  - By default behaviour will remain similar and both bar & TimeScale marks will be removed.
  - Passing `ClearMarksMode.BarMarks` will only remove bar marks.
  - Passing `ClearMarksMode.TimeScaleMarks` will only remove TimeScale marks.
- **`BREAKING CHANGE` Discrepancy in chart style/type methods.** Only TypeScript breaking change as an interface has been renamed to better reflect its purpose.
`SeriesStyle` is now [SeriesType](https://www.tradingview.com/charting-library-docs/latest/api/enums/Charting_Library.SeriesType).

**Bug Fixes**

- **load_study_template event is not emitted.** load_study_template event was not emitted when applying a template on the chart.
- **Fixed autosize bug occurring on Chrome iOS when rotating the device.** Workaround fix for a browser bug until Chrome resolves the issue on their side.
- **Fixed the type definitions for a few of the PineJS Std library functions.** [PineJSStd documentation](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.PineJSStd).

**Documentation**

- **New Key Features article.** We have added the [Key Features](https://www.tradingview.com/charting-library-docs/latest/introduction#key-features) article that lists features supported/unsupported in Advanced Charts and Trading Platform.
- **How to connect data via Datafeed API.** We have added a new [tutorial on connecting data via Datafeed API](https://www.tradingview.com/charting-library-docs/latest/tutorials/implement_datafeed_tutorial/).
It will help you implement datafeed and real-time data streaming to Advanced Charts step-by-step.

**Other**

- **Incorrect watermark property key.** Deprecated `symbolWatermarkProperties` property has now been removed.
Please use [settings_adapter](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.ChartingLibraryWidgetOptions#settings_adapter) with `symbolWatermark` key instead or `applyOverrides` to change values.

## Version 24.003

*Date: Tue Apr 11 2023*

**New Features**

- **Images within bar marks.** Bar marks now support the rendering of images as the background by specifying the `imageUrl` property. Please see the [Mark](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.Mark) interface for more details.
- **Price Source and Long Description symbol info fields.** Add support for displaying the price source and long description fields from the symbol info.
  - To enable the price source first add `symbol_info_price_source` to the list of enabled features. Then it will be shown in the legend, if available. It can be hidden through the legend context menu and the series property dialog.
  - To enable the long description first add `symbol_info_long_description` to the list of enabled features. Then it will be shown in the legend, if available. It can be hidden through the legend context menu and the series property dialog.

**Improvements**

- **Added more styling options for bar marks.** The styling options for bar marks has been expanded to include options for styling the border.
  - Border color can be set using the `border` property within `color` of the Mark interface. See [MarkCustomColor](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.MarkCustomColor)
  - Border width can be set using `borderWidth` and `hoveredBorderWidth`. See [Mark](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.Mark)
- **Drawing tools favorites can now be defined within widget constructor.** Drawing tools can now be defined as favorites using the [`favorites`](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.ChartingLibraryWidgetOptions#favorites) property of the widget constructor options. See [Favorites.drawingTools](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.Favorites#drawingtools) for more information.
- **Context menu API can now be used within the Watchlist.** `watchlist_context_menu` featureset is enabled by default. See [onContextMenu](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.IChartingLibraryWidget#oncontextmenu) for more details.
- **Improved typings within package.json.** The `package.json` bundled with the library has been improved to support newer versions of node, and offer improved typings.
- **Price scale now supports numbers with more than 10 decimal points.**
- **Timezone data has been updated.**

**Bug Fixes**

- **Chart type won't change when restoring default options.** The chart type will no longer change when restoring the default options within the chart settings dialog.
- **Last visible bar value in legend for overlay studies.** When `use_last_visible_bar_value_in_legend` featureset is enabled, overlay studies will display the value for the last visible item on the chart. This now matches the behavior for the main series.
- **Fixed zoom behavior for percentage right margin option.** Incorrect zooming behavior has been fixed for zoom buttons appearing on the chart, and the keyboard shortcuts. See `show_percent_option_for_right_margin` [featureset](https://www.tradingview.com/charting-library-docs/latest/customization/Featuresets) for more information.

**Documentation**

- **Add FAQ about unsubscribeBars delay.** Added [a new FAQ](https://www.tradingview.com/charting-library-docs/latest/resources/Frequently-Asked-Questions) about [`unsubscribeBars`](https://www.tradingview.com/charting-library-docs/latest/connecting_data/datafeed-api/required-methods#unsubscribebars) being called with a delay.

**Other**

- **Added symbol information to datafeed error messages.** Added symbol information to realtime subscription error messages to improve the developer experience.
- **Updated localisation list.** The [list of support localisations](https://www.tradingview.com/charting-library-docs/latest/configuration/Localization) has been updated. Additionally, the chart will now fallback to english (with a console warning) if an unsupported locale is specified in the widget constructor options.

## Version 24.002

**New Features**

- **Added support for specifying custom timezones.**
  - Additional custom timezones can now be specified for use within the library. Please see the [Adding Custom Timezones](https://www.tradingview.com/charting-library-docs/latest/ui_elements/timezones#adding-custom-time-zones) section within the Timezones page.
- **Images within timescale marks.**
  - Timescale marks now support the rendering of images within the circular shape by specifying the `imageUrl` property. Please see the [TimescaleMark](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.TimescaleMark) interface for more details.
- **Support different margin rates for different order types.** [6607](https://github.com/tradingview/charting_library/issues/6607)
  - `marginRate` has been deprecated
  - A [`supportLeverageButton`](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Broker.BrokerConfigFlags#supportleveragebutton) flag that displays a leverage button has been added to the Broker configuration.
  - The [`supportLeverage`](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Broker.BrokerConfigFlags#supportleverage) flag enables leverage calculation by getting information from `leverageInfo`.

**Enhancements**

- Add horizontal line at 0 for Momentum study.

**Bug fixes**

- [`setUserEditEnabled`](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.IStudyApi#setusereditenabled) does not hide 3 dots in Legend. [6765](https://github.com/tradingview/charting_library/issues/6765) | [6165](https://github.com/tradingview/charting_library/issues/6165)

      widget.activeChart().getAllStudies().forEach(({ id }) => {
        console.log(id);
        tvWidget.activeChart().getStudyById(id).setUserEditEnabled(false);
      });

  - setUserEditEnabled(false) should mask all icons except the "eye".
  - setUserEditEnabled(true) should restore all the icons.
- `priceFormatter` could previously only be used for main series. `priceFormatter` now applies to secondary series as well.
- `right_toolbar` featureset didn't have a default `on` value.
- Empty time frames at the bottom toolbar if `data_status: endofday`
- Export data doesn’t include projected data.
  - Projected data can be included by setting [`includeOffsetStudyValues`](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.ExportDataOptions#includeoffsetstudyvalues) to `true`.
  - `await widget.activeChart().exportData({ includeOffsetStudyValues: true });`
- Highest PineJS.Std function doesn’t work correctly with negative numbers.
- Missing types in bundled definition file. [7445](https://github.com/tradingview/charting_library/issues/7445) | [7446](https://github.com/tradingview/charting_library/issues/7446)
- Exposing `icon` prop in `CreateShapeOptionsBase`. [6723](https://github.com/tradingview/charting_library/issues/6723)
- Wrong extended session background color [7443](https://github.com/tradingview/charting_library/issues/7443)

**Documentation**

- Added [migration guide](https://www.tradingview.com/charting-library-docs/latest/trading_terminal/#how-to-migrate-from-advanced-charts) from TAC to CTP.
- Added additional documentation for [Drawings](https://www.tradingview.com/charting-library-docs/latest/ui_elements/drawings/).
- Missing overrides in documentation. [7457](https://github.com/tradingview/charting_library/issues/7457)
- Updated documentation for [Marks](https://www.tradingview.com/charting-library-docs/latest/ui_elements/Marks).
- Align ChartMetaInfo & ChartData.

**Other**

- Removed `Australia/ACT` from the list of [timezones](https://www.tradingview.com/charting-library-docs/latest/ui_elements/timezones) within our documentation. Please use either the Sydney timezone or [specify your own custom timezone](https://www.tradingview.com/charting-library-docs/latest/ui_elements/timezones#adding-custom-time-zones).

## Version 24.001

**New Features**

- **Adding originalText as an additional field to UndoRedoState.** Event should mention the name of the action in plain English in addition to also being translated to the corresponding language. [UndoRedoState](@api/interfaces/Charting_Library.UndoRedoState#originalundotext)
- **Add the ability to change X-Axis margin % from Chart Properties.** A new [featureset](@docs/customization/Featuresets) has been added `show_percent_option_for_right_margin` that adds additional percentage option to the right margin section of the chart settings dialog.
- **Display rightmost visible value when in percent mode.** A new [featureset](@docs/customization/Featuresets) has been added `use_last_visible_bar_value_in_legend` to show the most recent “global” bar value. When this feature is enabled the rightmost bar in the visible range is used instead.
- **Ability to change on the fly the Currency and Unit label setting.** [currencyAndUnitVisibility API](@api/interfaces/Charting_Library.IChartingLibraryWidget#currencyandunitvisibility)
- **Add simple SSR support.** Allow the library to be imported within a NodeJS context. This improves support for frameworks such as Remix.
- **Added [`clearUndoHistory`](@api/interfaces/Charting_Library.IChartingLibraryWidget#clearundohistory).**

**Improvements**

- **Name to be used instead of ticker.** Allow a human friendly name to be returned from [`symbol_search_complete`](@api/interfaces/Charting_Library.ChartingLibraryWidgetOptions#symbol_search_complete).

**Bug Fixes**

- **Incomplete indicators when using Heikin-Ashi.** Indicator line should draw to all the visible data points.
- **Compare study doesn’t save and restore ticker name correctly.** The compare study should work for custom ticker names just like it does for ticker names which match our format (with the colon).
- **VPFR: Right point is automatically moving when dragging start point.** When drawing the VPFR, or moving one of the anchor points, it is expected that the right anchor point should not move one bar further to the right.
- **Selecting Apply Defaults option within chart settings doesn’t work.** Some Settings even if not validated are not restored to their original values when Apply Defaults is selected.
- **Decentralised app browser loading error.** Chart fails to load in wallet apps like MetaMask, Trust & Phantom. Enable the `iframe_loading_compatibility_mode` [featureset](@docs/customization/Featuresets) to enable compatibility with these browsers.
- **When disabled, widget bar still present a significant margin.** Even when there aren't any pages or widget in the right toolbar and IF right_toolbar is disabled, contrary to the drawing toolbar that vanishes the widget bar stays there with the pill button to expand it whereas there isn't anything to expand.
- **Can’t enable header_compare feature without header_symbol_search.**
  - Disabling header_symbol_search should only hide the search button
  - Disabling header_compare should only hide the compare button
- **Removed section of PostCSS syntax in bundled css files.**

**Other**

- **New Documentation site.** 🎉
- **Add `shape` to TimeScale.** Shape property is described in [TimescaleMark interface](@api/interfaces/Charting_Library.TimescaleMark#shape).
- **Remove magnet icon near cursor.**

## Version 24

- `preset` Widget-Constructor parameter has been removed. Users can still use some featuresets to mimic the same behavior by disabling the following list:
  - `'left_toolbar', 'header_widget', 'timeframes_toolbar', 'edit_buttons_in_legend', 'context_menus', 'control_bar', 'border_around_the_chart'`
- `chart_style_hilo` featureset is now enabled by default. This adds the High-low option to chart style controls dropdown. This featureset has been available since 1.15 but was previously disabled by default.
- Added typings for custom indicators. Typescript equivalents of our existing examples are available here: [Custom Studies Typescript Examples](https://www.tradingview.com/charting-library-docs/latest/custom_studies/Custom-Studies-Examples).
- [`symbol_search_complete`](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.ChartingLibraryWidgetOptions#symbol_search_complete) has changed. The function now takes an additional search result object parameter, and returns an additional human-friendly symbol name.

**UI changes**

- With this version you will notice that the top toolbar has been redesigned with the following changes:

  - Button padding & separator size have been reduced
  - Compare button has shifted next to Symbol
  - Drawing icon is now more prominent
  - New fullscreen icon
  - Save button style better highlights when there's a change
  - Top toolbar now extends to left & right edges
  - UI font changes to a default system one
  - Undo/redo buttons are now relocated next to the save button

**Trading Platform**

- Default formatter `textNoWrap` has been removed.
- `columnId` field of [SortingParameters](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Broker.SortingParameters) has been renamed to `property`.
- Required `id` field has been added to [column description](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Broker.AccountManagerColumnBase#id).
- Type of `formatter` field in [column description](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Broker.AccountManagerColumnBase#formatter) has been changed to [StandardFormatterName | FormatterName](https://www.tradingview.com/charting-library-docs/latest/api/enums/Charting_Library.StandardFormatterName).
- `property` field has been removed from `column description`. Use [dataFields](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Broker.AccountManagerColumnBase#datafields) field instead.
- Type of `formatter` field in [SummaryField](https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Broker.AccountManagerSummaryField) has been changed to [StandardFormatterName](https://www.tradingview.com/charting-library-docs/latest/api/enums/Charting_Library.StandardFormatterName).
