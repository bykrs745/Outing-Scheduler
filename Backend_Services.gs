/**
 * Backend_Services.gs
 * API通信、マスタ検索、外部API(Map/Weather)などの汎用ユーティリティ群
 */
function getSettings() {
const props = PropertiesService.getScriptProperties();
return {
  SS_ID: props.getProperty('SS_ID') || "1L7hdXLE3JysBaxFoXXB4oe9-KeGPklT8tTr23NV-nn8",
  API_KEY: props.getProperty('GOOGLE_API_KEY'),
  OPENWEATHER_API_KEY: props.getProperty('OPENWEATHER_API_KEY')
};
}
function getOriginAddress() {
return PropertiesService.getScriptProperties().getProperty('CURRENT_ORIGIN_ADDRESS') || "埼玉県志木市下宗岡1-8-18";
}
function searchMasterOrApi(keyword, apiKey) {
if (!apiKey) return [];
try {
  const res = UrlFetchApp.fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "post",
    headers: {
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.addressComponents,places.internationalPhoneNumber,places.websiteUri,places.regularOpeningHours,places.location",
      "Content-Type": "application/json"
    },
    payload: JSON.stringify({ textQuery: keyword, languageCode: "ja" }),
    muteHttpExceptions: true
  });
  if (res.getResponseCode() === 200) {
    const data = JSON.parse(res.getContentText());
    return data.places ? data.places.map(p => {
      let postal = "";
      if (p.addressComponents) {
        const pc = p.addressComponents.find(c => c.types.includes("postal_code"));
        if (pc) postal = pc.longText;
      }
      let bizHours = "未登録";
      if (p.regularOpeningHours && p.regularOpeningHours.weekdayDescriptions) {
        bizHours = p.regularOpeningHours.weekdayDescriptions.join("\n");
      }
      let rawAddr = p.formattedAddress ? p.formattedAddress.replace("日本、", "").replace(/〒?\d{3}-\d{4}\s?/, "").trim() : "";
     let addrParts = rawAddr.split(/[\s ]+/);
     let parsedAddr = addrParts[0] || "";
     let parsedBuild = addrParts.slice(1).join(" ") || "";

     return {
       placeId: p.id,
       name: p.displayName ? p.displayName.text : "",
       address: parsedAddr,
       building: parsedBuild,
       postal: postal,
       phone: p.internationalPhoneNumber || "未登録",
       website: p.websiteUri || "未登録",
       bizHours: bizHours,
       lat: p.location ? p.location.latitude : null,
       lng: p.location ? p.location.longitude : null
    };
  }) : [];
 }
} catch (e) {
  Logger.log("Places API 検索エラー: " + e.message);
}
return [];
}
function calculateTransitRouteDetailsMultiple(startTime, date, destinationAddr) {
try {
 let timeStr = startTime.toString();
 if (timeStr.includes(" ")) timeStr = timeStr.split(" ")[1];
 const timeParts = timeStr.split(":");
 if (timeParts.length < 2) return { success: false, message: "時間指定エラー", durationMinutes: 0 };
 const today = new Date();
 let queryDate = new Date(date);
 queryDate.setHours(parseInt(timeParts[0], 10), parseInt(timeParts[1], 10), 0, 0);
 if (queryDate.getTime() < today.getTime()) {
   queryDate = new Date(today);
   queryDate.setHours(parseInt(timeParts[0], 10), parseInt(timeParts[1], 10), 0, 0);
 }
 const d = Maps.newDirectionFinder()
   .setOrigin(getOriginAddress())
   .setDestination(destinationAddr)
   .setMode(Maps.DirectionFinder.Mode.TRANSIT)
   .setDepart(queryDate)
   .setLanguage("ja")
   .setAlternatives(true)
   .getDirections();
 if (d.routes && d.routes.length > 0) {
   const formattedRoutes = d.routes.slice(0, 3).map((route, index) => {
     const leg = route.legs[0];
     let firstWalkMinutes = 5;
     let depStop = null;
     let arrStop = "目的地最寄り";
     
     const stepsList = leg.steps.map((s, stepIdx) => {
       const durationText = s.duration.text.replace("mins", "分").replace("min", "分");
       if (s.transit_details) {
         const td = s.transit_details;
         const type = td.line.vehicle.type === "BUS" ? "バス" : "電車";
         
         let tdDepName = td.departure_stop.name || "";
         let tdArrName = td.arrival_stop.name || "";
         const cleanDep = tdDepName.replace(/\s*[\(（]バス[\)）]\s*/g, "").replace(/\s*[\[［].*?[\]］]\s*/g, "").trim();
         const cleanArr = tdArrName.replace(/\s*[\(（]バス[\)）]\s*/g, "").replace(/\s*[\[［].*?[\]］]\s*/g, "").trim();

         // 🌟 最初に見つかった交通機関の出発地だけを記憶し、以降は上書きしない
         if (depStop === null) {
           depStop = cleanDep || "宮戸橋";
         }
         arrStop = cleanArr || "目的地最寄り";
         
         const lineName = td.line.short_name || td.line.name || "";
        const depTime = td.departure_time ? td.departure_time.text : "";
       
        return {
          type: type,
          line: lineName,
          dep: cleanDep,
          arr: cleanArr,
          duration: durationText,
          depTime: depTime
        };
      }
       const walkMin = Math.ceil(s.duration.value / 60);
       if (stepIdx === 0) {
         firstWalkMinutes = walkMin;
       }
       return {
         type: "徒歩",
         duration: durationText
       };
     });
     
     if (depStop === null) depStop = "宮戸橋";

     const stepsText = leg.steps.map((s, stepIdx) => {
       if (s.transit_details) {
         const td = s.transit_details;
         const type = td.line.vehicle.type === "BUS" ? "バス" : "電車";
         return `${type} (${td.line.short_name || td.line.name}) [${td.departure_stop.name}  ⇨  ${td.arrival_stop.name}]`;
       }
       return `徒歩 ${s.duration.text.replace("mins", "分").replace("min", "分")}`;
     }).join("\n⇩\n");
     const totalDuration = leg.duration.text.replace("mins", "分").replace("min", "分");
     const totalDistance = (leg.distance.value / 1000).toFixed(1);
     const durationMinVal = Math.ceil(leg.duration.value / 60);
     return {
      summary: `${stepsText}\n(${totalDuration} / ${totalDistance}km)`,
      totalDurationText: totalDuration,
      totalDistanceText: totalDistance,
      fareText: route.fare ? route.fare.text : "",
      stepsList: stepsList,
      durationMinutes: durationMinVal,
       firstWalkMinutes: firstWalkMinutes,
       depStop: depStop,
       arrStop: arrStop
     };
   });
   return { success: true, routes: formattedRoutes };
 }
 return { success: false, message: "該当ルートが見つかりませんでした", durationMinutes: 0 };
} catch (e) {
 return { success: false, message: "ルート計算エラー: " + e.message, durationMinutes: 0 };
}
}
function getWeatherData(address, parsedDate, arrivalTimeVal, apiKey) {
if (!apiKey || !parsedDate || !arrivalTimeVal) return { icon: "📅", temp: "-" };
try {
  const cleanGeoQuery = address.toString().replace("日本、", "").replace(/〒?\d{3}-\d{4}\s?/, "").trim();
  const geoRes = Maps.newGeocoder().setLanguage('ja').geocode("日本 " + cleanGeoQuery);
  if (geoRes.status !== 'OK') return { icon: "📅", temp: "-" };
  const lat = geoRes.results[0].geometry.location.lat;
  const lng = geoRes.results[0].geometry.location.lng;
  const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lng}&appid=${apiKey}&units=metric&lang=ja`;
  const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  if (response.getResponseCode() !== 200) return { icon: "📅", temp: "-" };
  const data = JSON.parse(response.getContentText());
  let targetDateObj = new Date(parsedDate.getTime());
  if (arrivalTimeVal instanceof Date) {
    targetDateObj.setHours(arrivalTimeVal.getHours(), arrivalTimeVal.getMinutes(), 0, 0);
  } else {
    const timeParts = arrivalTimeVal.toString().replace(/'/g, "").trim().split(":");
    if (timeParts.length >= 2) targetDateObj.setHours(parseInt(timeParts[0], 10), parseInt(timeParts[1], 10), 0, 0);
  }
  const targetTimeMs = targetDateObj.getTime();
  let closestForecast = null;
  let minDiff = Infinity;
  for (const item of data.list) {
    let diff = Math.abs(item.dt * 1000 - targetTimeMs);
    if (diff < minDiff) { minDiff = diff; closestForecast = item; }
  }
  if (minDiff > 24 * 60 * 60 * 1000 || !closestForecast) return { icon: "📅", temp: "-" };
  const temp = Math.round(closestForecast.main.temp);
  const weatherId = closestForecast.weather[0].id;
  let icon = "🌤️";
  if (weatherId >= 200 && weatherId < 300) icon = "⛈️";
  else if (weatherId >= 300 && weatherId < 500) icon = "🌧️";
  else if (weatherId >= 500 && weatherId < 600) icon = "☂️";
  else if (weatherId >= 600 && weatherId < 700) icon = "❄️";
  else if (weatherId >= 700 && weatherId < 800) icon = "🌫️";
  else if (weatherId === 800) icon = "☀️";
  else if (weatherId === 801) icon = "🌤️";
  else if (weatherId === 802) icon = "⛅";
  else if (weatherId === 803 || weatherId === 804) icon = "🌥️";
  return { icon, temp };
} catch (e) {
  return { icon: "📅", temp: "-" };
}
}
/**
 * Google Places API を用いて写真URLを取得する (旧APIエンドポイントを使用)
 */
function fetchThumbnailFromWeb(placeId) {
  const settings = getSettings();
  if (!settings.API_KEY || !placeId) return { success: false, message: "API_KEY or placeId is empty" };
  
  try {
    const detailsUrl = "https://maps.googleapis.com/maps/api/place/details/json?place_id=" + placeId + "&fields=photos&key=" + settings.API_KEY + "&language=ja";
    const detailsRes = UrlFetchApp.fetch(detailsUrl, { muteHttpExceptions: true });
    const dCode = detailsRes.getResponseCode();
    
    if (dCode === 200) {
      const data = JSON.parse(detailsRes.getContentText());
      if (data.result && data.result.photos && data.result.photos.length > 0) {
        const photoReference = data.result.photos[0].photo_reference;
        const photoUrl = "https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=" + photoReference + "&key=" + settings.API_KEY;
        
        // リダイレクトを追跡しない
        const photoRes = UrlFetchApp.fetch(photoUrl, { followRedirects: false, muteHttpExceptions: true });
        const pCode = photoRes.getResponseCode();
        
        if (pCode >= 300 && pCode < 400) {
           const headers = photoRes.getHeaders();
           const actualUrl = headers['Location'] || headers['location'];
           return { success: true, url: actualUrl };
        } else if (pCode === 200) {
           return { success: true, message: "画像データ直接取得", url: photoUrl };
        } else {
           return { success: false, message: "Photo API Error", code: pCode };
        }
      } else {
         return { success: false, message: "No photos found", detailsData: data };
      }
    } else {
       return { success: false, message: "Details API Error", code: dCode, response: detailsRes.getContentText() };
    }
  } catch(e) {
    return { success: false, message: "Try Catch Error: " + e.message };
  }
}
/**
 * 毎月1日に実行されるバス時刻表更新トリガーの設定
 */
function setupMonthlyBusTrigger() {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(t => {
    if (t.getHandlerFunction() === 'updateBusDiagram') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('updateBusDiagram').timeBased().onMonthDay(1).atHour(3).create();
}
/**
 * Gemini APIでバス時刻表PDFをOCR解析してマスタを更新
 */
function updateBusDiagram() {
  const props = PropertiesService.getScriptProperties();
  const apiKey = props.getProperty('GEMINI_API_KEY');
  if (!apiKey) return;
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = ("0" + (today.getMonth() + 1)).slice(-2);
  const dateParam = `${yyyy}-${mm}-01`;
  const pdfUrl = `https://transfer.navitime.biz/5931bus/pc/diagram/DiagramPdfCreate?course=0001000429&startId=00021347&stopNo=15&date=${dateParam}`;

  try {
    const pdfBlob = UrlFetchApp.fetch(pdfUrl).getBlob();
    const pdfBase64 = Utilities.base64Encode(pdfBlob.getBytes());
    const apiURL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=" + apiKey;
    const payload = {
      contents: [{
        parts: [
          { text: "このPDFはバスの時刻表です。内容を解析し、「曜日区分(平日/土曜日/日祝日のいずれか),時(数値のみ),分(数値のみ),表示用時刻(H:mmまたはHH:mm)」のCSV形式で出力してください。ヘッダー行やマークダウン(```csv 等)は絶対に出力せず、純粋なデータのみをカンマ区切りで出力してください。系統番号や行き先は不要です。" },
          { inline_data: { mime_type: "application/pdf", data: pdfBase64 } }
        ]
      }]
    };

    let res;
    let success = false;
    const maxRetries = 3;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      res = UrlFetchApp.fetch(apiURL, { method: "post", contentType: "application/json", payload: JSON.stringify(payload), muteHttpExceptions: true });
      if (res.getResponseCode() === 200) { success = true; break; } 
      else { if (attempt < maxRetries) Utilities.sleep(attempt * 2000); }
    }

    if (success) {
      const json = JSON.parse(res.getContentText());
      if (json.candidates && json.candidates.length > 0) {
        let text = json.candidates[0].content.parts[0].text;
        text = text.replace(/```csv/g, '').replace(/```/g, '').trim();
        const rows = text.split('\n');
        const data = [];
        for (let i = 0; i < rows.length; i++) {
          const cols = rows[i].split(',');
          if (cols.length >= 4) {
            const h = parseInt(cols[1].trim(), 10);
            const m = parseInt(cols[2].trim(), 10);
            if (!isNaN(h) && !isNaN(m)) {
               const id = "ID_" + ("000" + (data.length + 1)).slice(-3);
               data.push([id, cols[0].trim(), h, m, cols[3].trim()]);
            }
          }
        }
        if (data.length > 0) {
          const ss = SpreadsheetApp.getActiveSpreadsheet();
          let sheet = ss.getSheetByName("時刻表マスタ");
          if (!sheet) sheet = ss.insertSheet("時刻表マスタ");
          const lastRow = sheet.getLastRow();
          if (lastRow > 1) sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).clearContent();
          sheet.getRange(2, 1, data.length, data[0].length).setValues(data);
          const nowStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy/MM/dd HH:mm:ss");
          sheet.getRange("G1").setValue("最終更新日時");
          sheet.getRange("G1").setFontWeight("bold").setBackground("#f3f3f3");
          sheet.getRange("G2").setValue(nowStr);
        }
      }
    }
  } catch (e) {
Logger.log("バス時刻表更新エラー: " + e.message);
}
}