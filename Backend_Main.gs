/**
 * Backend_Main.gs
 * WEBアプリのエントリーポイントと、HTMLテンプレート読み込み機能
 */

function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('★アプリメニュー')
      .addItem('メイン画面を開く', 'showSidebar')
      .addToUi();
}

function showSidebar() {
  // 今後のHTML分割を見据えてevaluate()を使用します
  const html = HtmlService.createTemplateFromFile('app')
      .evaluate()
      .setTitle('外出Scheduler')
      .setWidth(450);
  SpreadsheetApp.getUi().showSidebar(html);
}

function doGet() {
  // 今後のHTML分割を見据えてevaluate()を使用します
  return HtmlService.createTemplateFromFile('app')
      .evaluate()
      .setTitle('外出Scheduler')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-select=none');
}

/**
 * 別のHTMLファイル（CSSやJS）を読み込むためのヘルパー関数
 * 今後、app.html を js_main.html や css_styles.html に分割する際に使用します。
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}