/**
 * Backend_API.gs
 * フロントエンドから `google.script.run` 経由で呼び出されるAPI群
 */
function getDayInfoForWeb(dateStr) {
 const parsedDate = new Date(dateStr.replace(/-/g, "/"));
 if (isNaN(parsedDate.getTime())) return { error: "Invalid Date" };
  let holiday = "";
 let seasonal = "";
  try {
   const holidays = CalendarApp.getCalendarById('ja.japanese#holiday@group.v.calendar.google.com').getEventsForDay(parsedDate);
   if (holidays.length > 0) {
     const title = holidays[0].getTitle();
     const nationalHolidays = ["元日", "成人の日", "建国記念の日", "天皇誕生日", "春分の日", "昭和の日", "憲法記念日", "みどりの日", "こどもの日", "海の日", "山の日", "敬老の日", "秋分の日", "スポーツの日", "文化の日", "勤労感謝の日", "振替休日", "国民の休日"];
    
     let isNationalHoliday = false;
     for (let i = 0; i < nationalHolidays.length; i++) {
       if (title.indexOf(nationalHolidays[i]) !== -1) {
         isNationalHoliday = true;
         break;
       }
     }
     if (isNationalHoliday) {
       holiday = title;
     } else {
       seasonal = title;
     }
   }
 } catch(e) {}
  const day = parsedDate.getDay();
 let dayType = "平日";
 let colorClass = "text-gray-900";
 if (holiday !== "" || day === 0) {
   dayType = "日祝日";
   colorClass = "text-red-500";
 } else if (day === 6) {
   dayType = "土曜日";
   colorClass = "text-blue-500";
 }
 const ss = SpreadsheetApp.getActiveSpreadsheet();
 const sheet = ss.getSheetByName("時刻表マスタ");
 const busTimes = [];
 if (sheet) {
   const data = sheet.getDataRange().getValues();
   for (let i = 1; i < data.length; i++) {
     const cat = data[i][1] ? data[i][1].toString().trim() : "";
     let masterTime = "";
     let h = parseInt(data[i][2], 10);
     let m = parseInt(data[i][3], 10);
     if (!isNaN(h) && !isNaN(m)) {
       masterTime = ("0" + h).slice(-2) + ":" + ("0" + m).slice(-2);
     }
     if (cat.indexOf(dayType) !== -1 || cat === "") {
       if(masterTime) busTimes.push(masterTime);
     }
   }
 }
 const uniqueBusTimes = busTimes.filter((x, i, self) => self.indexOf(x) === i).sort();
 return { holiday: holiday, seasonal: seasonal, dayType: dayType, colorClass: colorClass, busTimes: uniqueBusTimes };
}
function getRoutesForWeb(dateStr, timeStr, destinationAddr) {
 return calculateTransitRouteDetailsMultiple(timeStr, dateStr, destinationAddr);
}
function getLatestPlaceDetails(placeId, name, address) {
 const settings = getSettings();
 let latestInfo = null;
 if (settings.API_KEY && placeId) {
   const results = searchMasterOrApi(name + " " + address, settings.API_KEY);
   for(let i=0; i<results.length; i++){
     if(results[i].placeId === placeId) {
       latestInfo = results[i];
       break;
     }
   }
   if(!latestInfo && results.length > 0) latestInfo = results[0];
 }
 return { success: !!latestInfo, data: latestInfo };
}

function getHomeListForWeb() {
 try {
   const ss = SpreadsheetApp.getActiveSpreadsheet();
   const sheet = ss.getSheetByName("Home");
   if (!sheet) return [];
  
   const colMap = getColumnMap(sheet);
   const lastRow = sheet.getLastRow();
   if (lastRow < 2) return [];
  
   const list = [];
   for (let r = lastRow; r >= 2; r--) {
      const rowObj = getRowDataAsObject(sheet, r, colMap);
      if (rowObj["名前"]) {
        const latlng = rowObj["緯度経度"] ? rowObj["緯度経度"].toString().split(",") : [];
        list.push({
          id: rowObj["ユニークID"] || ("item_" + r),
          placeId: rowObj["PlaceID"] ? rowObj["PlaceID"].toString().trim() : "",
          lat: latlng.length > 0 ? parseFloat(latlng[0]) : null,
          lng: latlng.length > 1 ? parseFloat(latlng[1]) : null,
          name: rowObj["名前"] ? rowObj["名前"].toString().trim() : "名称未設定",
         address: rowObj["住所"] ? rowObj["住所"].toString().trim() : "",
        postal: rowObj["郵便"] ? rowObj["郵便"].toString().trim() : "",
        building: rowObj["建物"] ? rowObj["建物"].toString().trim() : "",
        phone: rowObj["電話"] ? rowObj["電話"].toString().trim() : "",
        website: rowObj["WEB"] ? rowObj["WEB"].toString().trim() : "",
        bizHours: rowObj["営業時間"] ? rowObj["営業時間"].toString().trim() : "",
        date: rowObj["出発日"] ? Utilities.formatDate(new Date(rowObj["出発日"]), Session.getScriptTimeZone(), "yyyy/MM/dd") : "日付未設定",
        startTime: rowObj["出発時間"] ? rowObj["出発時間"].toString().replace(/'/g, "").trim() : "",
        busTime: rowObj["バス停時間"] ? rowObj["バス停時間"].toString().replace(/'/g, "").trim() : "",
         stayTime: rowObj["滞在時間"] ? rowObj["滞在時間"].toString().trim() : "",
         arrTime: rowObj["目的地到着時間"] ? rowObj["目的地到着時間"].toString().replace(/'/g, "").trim() : "",
         retTime: rowObj["帰宅時間"] ? rowObj["帰宅時間"].toString().replace(/'/g, "").trim() : "",
         calType: rowObj["カレンダー種別"] ? rowObj["カレンダー種別"].toString().trim() : "",
        holiday: rowObj["祝日"] ? rowObj["祝日"].toString().trim() : "",
        seasonal: rowObj["季節の行事"] ? rowObj["季節の行事"].toString().trim() : "",
        routeData: rowObj["選択ルート"] ? rowObj["選択ルート"].toString().trim() : "",
        wStart: rowObj["天気1"] ? rowObj["天気1"].toString().trim() : "",
        wArr: rowObj["天気2"] ? rowObj["天気2"].toString().trim() : "",
        wRet: rowObj["天気3"] ? rowObj["天気3"].toString().trim() : "",
        eventId: rowObj["イベントID"] ? rowObj["イベントID"].toString().trim() : "",
        icon: rowObj["アイコン"] ? rowObj["アイコン"].toString().trim() : ""
      });
    }
   }
   return list;
 } catch (e) {
   return [];
 }
}
function getMasterListForWeb() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("目的地一覧マスタ");
    if (!sheet) return [];
    
    const colMap = getColumnMap(sheet);
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return [];
    
    const list = [];
    for (let r = 2; r <= lastRow; r++) {
      const rowObj = getRowDataAsObject(sheet, r, colMap);
      if (rowObj["名前"]) {
        const latlng = rowObj["緯度経度"] ? rowObj["緯度経度"].toString().split(",") : [];
        list.push({
          placeId: rowObj["PlaceID"] ? rowObj["PlaceID"].toString().trim() : "",
          name: rowObj["名前"] ? rowObj["名前"].toString().trim() : "",
          postal: rowObj["郵便"] ? rowObj["郵便"].toString().trim() : "",
          address: rowObj["住所"] ? rowObj["住所"].toString().trim() : "",
          building: rowObj["建物"] ? rowObj["建物"].toString().trim() : "",
          lat: latlng.length > 0 ? parseFloat(latlng[0]) : null,
          lng: latlng.length > 1 ? parseFloat(latlng[1]) : null,
          phone: rowObj["電話"] ? rowObj["電話"].toString().trim() : "未登録",
          website: rowObj["WEB"] ? rowObj["WEB"].toString().trim() : "未登録",
          bizHours: rowObj["営業時間"] ? rowObj["営業時間"].toString().trim() : "未登録"
        });
      }
    }
    return list;
  } catch (e) {
    return [];
  }
}
function getCalendarTemplateSettings() {
  const defaultTitle = "{{名前}}【出発: {{出発時間}}】【バス: {{バス停時間}}】【到着: {{目的地到着時間}}】";
  const defaultLocation = "{{名前}}\n日本、{{郵便}} {{住所}} {{建物}}";
  const defaultDesc = `＝/＝/＝/＝/＝/＝/＝/＝/＝/＝/＝
🏥 {{名前}}
＝/＝/＝/＝/＝/＝/＝/＝/＝/＝/＝
･~･~･~･~･~･~･~･~･~･~･~･~･~･
🌐 {{WEB}}   📞 {{電話}}
･~･~･~･~･~･~･~･~･~･~･~･~･~･
🕤️ 営業時間【{{曜日}}曜日】
{{営業時間}}
🗓️ {{日付}}{{祝日}}{{行事}}
{{天気1}}
 🏠【出 発】{{出発時間漢字}}
 ⇩
 🚌【バス停】{{バス停時間漢字}}
 ⇩
{{天気2}}
 🏥【目的地】{{目的地到着時間漢字}} ✨
 🪑【滞 在】{{滞在時間}}
 ⇩
{{天気3}}
 🏠【帰 宅】{{帰宅時間漢字}}`;

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("設定");
    if (!sheet) {
      return { title: defaultTitle, location: defaultLocation, description: defaultDesc };
    }

    const values = sheet.getRange("B2:B4").getValues();
    return {
      title: values[0][0] ? values[0][0].toString() : defaultTitle,
      location: values[1][0] ? values[1][0].toString() : defaultLocation,
      description: values[2][0] ? values[2][0].toString() : defaultDesc
    };
  } catch (e) {
    return { title: defaultTitle, location: defaultLocation, description: defaultDesc };
  }
}

function saveCalendarTemplateSettings(settings) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("設定");
    if (!sheet) return { success: false, message: "設定シートが見つかりません" };

    sheet.getRange("B2:B4").setValues([
      [settings.title],
      [settings.location],
      [settings.description]
    ]);
    return { success: true };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

function getSpreadsheetUrl() {
  return SpreadsheetApp.getActiveSpreadsheet().getUrl();
}

function executeWebSearch(keyword) {
 const settings = getSettings();
 let results = [];
 if (settings.API_KEY) {
   results = searchMasterOrApi(keyword, settings.API_KEY);
 }
  if (results.length === 1) {
   return { success: true, message: "1件見つかり、自動選択されました", data: results };
 } else if (results.length > 1) {
   return { success: true, message: "候補が " + results.length + " 件見つかりました。選択してください。", data: results };
 } else {
   return { success: false, message: "該当がありませんでした", data: [] };
 }
}
function executeFullAutomation(data, rowNumber) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Home");
  const colMap = getColumnMap(sheet);
  let targetRow = sheet.getLastRow() + 1;
  let uniqueId = data.editId || ("ID_" + new Date().getTime() + "_" + Math.floor(Math.random() * 1000));
  
  if (data.editId) {
    const idVals = sheet.getRange(2, colMap["ユニークID"], sheet.getLastRow() - 1, 1).getValues();
    for (let i = 0; i < idVals.length; i++) {
      if (idVals[i][0] === data.editId) {
        targetRow = i + 2;
        break;
      }
    }
  }

  const valText = data.name + " / " + data.address + " / " + data.placeId;
  const nowStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy/MM/dd HH:mm:ss");

  // Googleカレンダーへのイベント作成
  let eventId = data.eventId || "";
  try {
    eventId = createGoogleCalendarEvent(data);
  } catch (e) {
    Logger.log("Googleカレンダー登録エラー: " + e.message);
  }

  const valuesToSet = {
    "登録日時": nowStr,
    "ユニークID": uniqueId,
    "選択": valText,
    "名前": data.name,
    "郵便": data.postal,
    "住所": data.address,
    "建物": data.building,
    "電話": data.phone,
    "WEB": data.website,
    "営業時間": data.bizHours,
    "PlaceID": data.placeId,
    "緯度経度": (data.lat && data.lng) ? data.lat + "," + data.lng : "",
    "出発日": data.date,
    "滞在時間": data.stayTime,
    "祝日": data.holiday,
    "季節の行事": data.seasonalEvent,
    "出発時間": data.startTime,
    "バス停時間": data.busTime,
    "目的地到着時間": data.arrTime,
    "帰宅時間": data.retTime,
    "選択ルート": data.routeData || "",
    "天気1": data.wStart || "",
    "天気2": data.wArr || "",
    "天気3": data.wRet || "",
    "カレンダー種別": data.calType,
    "アイコン": data.icon || "",
    "イベントID": eventId,
    "INFO": "WEBアプリより登録完了"
  };

  for (let colName in valuesToSet) {
    let colIndex = colMap[colName];
    if (colIndex) {
      sheet.getRange(targetRow, colIndex).setValue(valuesToSet[colName]);
    }
  }
  SpreadsheetApp.flush();
  return { success: true, message: "スプレッドシートおよびGoogleカレンダーへの登録が完了しました！" };
}

function createGoogleCalendarEvent(data) {
 let calendar = null;
 if (data.calId) {
   try { calendar = CalendarApp.getCalendarById(data.calId); } catch(e) {}
 }
 if (!calendar && data.calType) {
   const ss = SpreadsheetApp.getActiveSpreadsheet();
   const sheet = ss.getSheetByName("共通マスタ");
   if (sheet) {
     const vals = sheet.getDataRange().getValues();
     for (let i = 1; i < vals.length; i++) {
       if (vals[i][1] && vals[i][1].toString().trim() === data.calType.trim()) {
         const cId = vals[i][2] ? vals[i][2].toString().trim() : "";
         if (cId) { try { calendar = CalendarApp.getCalendarById(cId); } catch(e) {} }
         break;
       }
     }
   }
 }
 if (!calendar) {
   try { calendar = CalendarApp.getDefaultCalendar(); } catch(e) {}
 }
 if (!calendar) return "";

  const cleanDateStr = (data.date || "").toString().replace(/['\s]/g, "").replace(/-/g, "/");
  const cleanStartTime = (data.startTime || "09:00").toString().replace(/['\s]/g, "");
  const cleanBusTime = (data.busTime || "").toString().replace(/['\s]/g, "");
  const cleanArrTime = (data.arrTime || "").toString().replace(/['\s]/g, "");
  const cleanRetTime = (data.retTime || "12:00").toString().replace(/['\s]/g, "");

  const startParts = cleanStartTime.split(":");
  const retParts = cleanRetTime.split(":");

  const startDate = new Date(cleanDateStr);
 if (isNaN(startDate.getTime())) return "";
 const startDateTime = new Date(startDate.getTime());
 const parseHour = (str, def) => { const v = parseInt(str, 10); return isNaN(v) ? def : v; };
 startDateTime.setHours(parseHour(startParts[0], 9), parseHour(startParts[1], 0), 0, 0);
 const endDateTime = new Date(startDate.getTime());
 endDateTime.setHours(parseHour(retParts[0], 12), parseHour(retParts[1], 0), 0, 0);

  if (endDateTime.getTime() <= startDateTime.getTime()) {
    endDateTime.setTime(startDateTime.getTime() + 2 * 60 * 60 * 1000);
  }

  const formatTimeKanji = (tStr) => {
    if (!tStr || tStr.indexOf(":") === -1) return tStr || "";
    const p = tStr.replace(/'/g, "").trim().split(":");
    return `${parseInt(p[0], 10)}時${p[1]}分`;
  };

  let webText = "未登録";
  if (data.website && data.website !== "未登録" && data.website !== "登録なし") {
    webText = `<a href="${data.website}">Web</a>`;
  }

  const jpDays = ["日", "月", "火", "水", "木", "金", "土"];
  const yyyy = startDate.getFullYear();
  const mm = startDate.getMonth() + 1;
  const dd = startDate.getDate();
  const dayName = jpDays[startDate.getDay()];
  const dateFormatted = `${yyyy}年${mm}月${dd}日(${dayName})`;
 let bizHoursFormatted = "未登録";
 if (data.bizHours && data.bizHours !== "---" && data.bizHours !== "未登録") {
   const lines = data.bizHours.split("\n");
   const filteredLines = lines.filter(l => l.indexOf("曜日") === -1 && l.trim() !== "");
   if (filteredLines.length > 0) {
     bizHoursFormatted = filteredLines.join("\n");
   }
 }

  const tmpl = getCalendarTemplateSettings();
  
  // 🌟 変数（プレースホルダー）の辞書を作成
  const sIcon = data.icon && data.icon !== "🇯🇵" ? data.icon : "🌸";
  const map = {
    "{{名前}}": data.name || "",
    "{{出発時間}}": cleanStartTime,
    "{{バス停時間}}": cleanBusTime,
    "{{目的地到着時間}}": cleanArrTime,
    "{{帰宅時間}}": cleanRetTime,
    "{{出発時間漢字}}": formatTimeKanji(cleanStartTime),
    "{{バス停時間漢字}}": formatTimeKanji(cleanBusTime),
    "{{目的地到着時間漢字}}": formatTimeKanji(cleanArrTime),
    "{{帰宅時間漢字}}": formatTimeKanji(cleanRetTime),
    "{{郵便}}": data.postal ? `〒${data.postal.replace("〒", "")}` : "",
    "{{住所}}": data.address || "",
    "{{建物}}": data.building || "",
    "{{電話}}": data.phone || "未登録",
    "{{WEB}}": webText,
    "{{曜日}}": dayName,
    "{{営業時間}}": bizHoursFormatted,
    "{{日付}}": dateFormatted,
    "{{祝日}}": data.holiday ? `\n  🇯🇵 ${data.holiday}` : "",
    "{{行事}}": data.seasonalEvent ? `\n  ${sIcon} ${data.seasonalEvent}` : "",
    "{{天気1}}": data.wStart || "🌤️ --℃",
   "{{天気2}}": data.wArr || "🌤️ --℃",
   "{{天気3}}": data.wRet || "🌤️ --℃",
   "{{滞在時間}}": data.stayTime || "---"
 };

 const replacePlaceholders = (text) => {
   let result = text || "";
   const bizMatch = result.match(/([ \t\u3000]*){{営業時間}}/);
  if (bizMatch) {
    const indent = bizMatch[1] || "";
    const indentedBiz = bizHoursFormatted.split(/\r?\n|\\n/).join('\n' + indent);
    result = result.replace(bizMatch[0], indent + indentedBiz);
  }
   for (const key in map) {
     if (key !== "{{営業時間}}") {
       result = result.split(key).join(map[key] || "");
     }
   }
   return result;
 };
 const isHospital = /(医院|病院|診療所|クリニック|科|医療)/.test(data.name || "");
 const facilityIcon = isHospital ? "🏥" : "🏢";
 let title = replacePlaceholders(tmpl.title).replace(/🏥|🏢/g, facilityIcon) || "予定";
 let location = replacePlaceholders(tmpl.location).replace(/🏥|🏢/g, facilityIcon) || "";
 let description = replacePlaceholders(tmpl.description).replace(/🏥|🏢/g, facilityIcon) || "";
let event = null;
 if (data.eventId) {
   try { event = calendar.getEventById(data.eventId); } catch(e) {}
 }
 
 try {
   if (event) {
     event.setTitle(title);
     event.setTime(startDateTime, endDateTime);
     event.setDescription(description);
     event.setLocation(location);
   } else {
     event = calendar.createEvent(title, startDateTime, endDateTime, {
       description: description,
       location: location
     });
   }
 } catch(e) {
   Logger.log("イベント作成エラー: " + e.message);
   return "";
 }

 // 通知（1時間前・5分前）※共有カレンダー等でエラーになるケースを回避
 if (event) {
   try {
     event.removeAllReminders();
     event.addPopupReminder(60);
     event.addPopupReminder(5);
   } catch(e) {
     Logger.log("リマインダー設定エラー: " + e.message);
   }
   return event.getId();
 }
 return "";
}
function getWeatherForWeb(address, dateStr, t1, t2, t3) {
  const settings = getSettings();
  const originAddr = getOriginAddress(); 
  const parsedDate = new Date(dateStr.replace(/-/g, "/"));
  
  function fetchWeatherWithCoords(addr, apiKey) {
    if (!apiKey) return null;
    try {
      const cleanGeoQuery = addr.toString().replace("日本、", "").replace(/〒?\d{3}-\d{4}\s?/, "").trim();
      const geoRes = Maps.newGeocoder().setLanguage('ja').geocode("日本 " + cleanGeoQuery);
      if (geoRes.status !== 'OK') return null;
      const lat = geoRes.results[0].geometry.location.lat;
      const lng = geoRes.results[0].geometry.location.lng;
      const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lng}&appid=${apiKey}&units=metric&lang=ja`;
      const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
      if (response.getResponseCode() !== 200) return null;
      return JSON.parse(response.getContentText());
    } catch(e) { return null; }
  }
  
  function getClosestForecast(data, targetTimeStr) {
    if (!data || !targetTimeStr) return { icon: "📅", temp: "-" };
    let targetDateObj = new Date(parsedDate.getTime());
    const timeParts = targetTimeStr.toString().replace(/'/g, "").trim().split(":");
    if (timeParts.length >= 2) targetDateObj.setHours(parseInt(timeParts[0], 10), parseInt(timeParts[1], 10), 0, 0);
    const targetTimeMs = targetDateObj.getTime();
    
    let closestForecast = null;
    let minDiff = Infinity;
    for (const item of data.list) {
      let diff = Math.abs(item.dt * 1000 - targetTimeMs);
      if (diff < minDiff) { minDiff = diff; closestForecast = item; }
    }
    
    // 🌟 許容誤差を24時間から3時間に縮小（過去の時間を指定した際のスナップ現象を防ぐ）
    if (minDiff > 3 * 60 * 60 * 1000 || !closestForecast) return { icon: "📅", temp: "-" };
    
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
  }
  
  const originData = fetchWeatherWithCoords(originAddr, settings.OPENWEATHER_API_KEY);
  const destData = fetchWeatherWithCoords(address, settings.OPENWEATHER_API_KEY);
  
  return {
    start: getClosestForecast(originData, t1),
    arr: getClosestForecast(destData, t2),
    ret: getClosestForecast(originData, t3)
  };
}
/**
 * 検索から選んだ新規目的地を「目的地一覧マスタ」に登録する
 */
function registerToMasterWeb(data) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("目的地一覧マスタ");
    if (!sheet) return;
    
    const colMap = getColumnMap(sheet);
    const lastRow = sheet.getLastRow();
    
    if (lastRow >= 2 && colMap["PlaceID"]) {
       const existingIds = sheet.getRange(2, colMap["PlaceID"], lastRow - 1, 1).getValues();
       for (let i = 0; i < existingIds.length; i++) {
          if (existingIds[i][0] == data.placeId) return; 
       }
    }
    
    const targetRow = lastRow + 1;
    const latlng = (data.lat && data.lng) ? data.lat + "," + data.lng : "";
    
    const valuesToSet = {
      "PlaceID": data.placeId || "",
      "名前": data.name || "",
      "郵便": data.postal || "",
      "住所": data.address || "",
      "建物": data.building || "",
      "緯度経度": latlng,
      "電話": data.phone || "未登録",
      "WEB": data.website || "未登録",
      "営業時間": data.bizHours || "未登録"
    };
    
    for (let colName in valuesToSet) {
      let colIndex = colMap[colName];
      if (colIndex) {
        sheet.getRange(targetRow, colIndex).setValue(valuesToSet[colName]);
      }
    }
  } catch(e) {
    Logger.log("マスタ登録エラー: " + e.message);
  }
}
function getCalendarMasterForWeb() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("共通マスタ");
    if (!sheet) return [];
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return [];
    
    const values = sheet.getRange(2, 2, lastRow - 1, 2).getValues();
    const list = [];
    for (let i = 0; i < values.length; i++) {
      const name = values[i][0] ? values[i][0].toString().trim() : "";
      const val = values[i][1] ? values[i][1].toString().trim() : name;
      if (name) {
        list.push({ name: name, value: val });
      }
    }
    return list;
  } catch (e) {
    return [];
  }
}

function deleteMasterItemsWeb(placeIds) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("目的地一覧マスタ");
    if (!sheet) return { success: false, message: "シートが見つかりません" };
    
    const data = sheet.getDataRange().getValues();
    const colMap = getColumnMap(sheet);
    const idCol = colMap["PlaceID"] ? colMap["PlaceID"] - 1 : -1;
    if (idCol === -1) return { success: false, message: "PlaceID列がありません" };
    
    let deletedCount = 0;
    for (let r = data.length - 1; r >= 1; r--) {
      const rowId = data[r][idCol];
      if (placeIds.indexOf(rowId) !== -1) {
        sheet.deleteRow(r + 1);
        deletedCount++;
      }
    }
    return { success: true, count: deletedCount };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

function deleteDeckItems(items) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Home");
  const data = sheet.getDataRange().getValues();
  const colMap = getColumnMap(sheet);
  const idCol = colMap["ユニークID"] ? colMap["ユニークID"] - 1 : -1;
  const eventIdCol = colMap["イベントID"] ? colMap["イベントID"] - 1 : -1;
  const calTypeCol = colMap["カレンダー種別"] ? colMap["カレンダー種別"] - 1 : -1;

  if (idCol === -1) return { success: false };

  for (let r = data.length - 1; r >= 1; r--) {
    const rowId = data[r][idCol];
    const target = items.find(item => String(item.id) === String(rowId));
    if (target) {
      const eventId = eventIdCol !== -1 ? data[r][eventIdCol] : "";
      const calType = calTypeCol !== -1 ? data[r][calTypeCol] : "";
      
      if (eventId) {
        try {
          let calendar = null;
          const masterSheet = ss.getSheetByName("共通マスタ");
          if (masterSheet && calType) {
            const mVals = masterSheet.getDataRange().getValues();
            for (let i = 1; i < mVals.length; i++) {
              if (mVals[i][1] === calType) {
                const cId = mVals[i][2];
                if (cId) calendar = CalendarApp.getCalendarById(cId);
                break;
              }
            }
          }
          if (!calendar) calendar = CalendarApp.getDefaultCalendar();
          if (calendar) {
            const event = calendar.getEventById(eventId);
            if (event) event.deleteEvent();
          }
        } catch(e) {
          Logger.log("イベント削除エラー: " + e.message);
        }
      }
      sheet.deleteRow(r + 1);
    }
  }
  return { success: true };
}

/**
 * 毎日朝4時に実行される天気自動更新トリガー
 * ※初回のみGASエディタから手動で1回実行してください
 */
function setupDailyWeatherTrigger() {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(t => {
    if (t.getHandlerFunction() === 'autoUpdateWeatherForUpcomingEvents') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('autoUpdateWeatherForUpcomingEvents').timeBased().everyHours(12).create();
}

/**
 * 向こう5日間の予定の天気を更新し、スプレッドシートとカレンダーに反映する
 */
function autoUpdateWeatherForUpcomingEvents() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Home");
  if (!sheet) return;
  
  const colMap = getColumnMap(sheet);
  const data = sheet.getDataRange().getValues();
  const today = new Date();
  today.setHours(0,0,0,0);
  const fiveDaysLater = new Date(today.getTime() + 5 * 86400000);
  
  let updatedCount = 0;
  
  for (let i = 1; i < data.length; i++) {
    const rowObj = getRowDataAsObject(sheet, i + 1, colMap);
    if (!rowObj["出発日"] || !rowObj["住所"]) continue;
    
    const d = new Date(rowObj["出発日"]);
    if (isNaN(d.getTime())) continue;
    d.setHours(0,0,0,0);
    
    // 今日から5日以内の予定に絞る
    if (d >= today && d <= fiveDaysLater) {
      const t1 = rowObj["出発時間"] || "08:00";
      const t2 = rowObj["目的地到着時間"] || "09:00";
      const t3 = rowObj["帰宅時間"] || "12:00";
      
      // 天気再取得
      const wRes = getWeatherForWeb(rowObj["住所"], rowObj["出発日"], t1, t2, t3);
      
      if (wRes && wRes.start && wRes.start.icon !== "📅" && wRes.start.temp !== "-") {
        const w1 = wRes.start.icon + " " + wRes.start.temp + "℃";
        const w2 = wRes.arr.icon + " " + wRes.arr.temp + "℃";
        const w3 = wRes.ret.icon + " " + wRes.ret.temp + "℃";
        
        // 既存の値と異なる場合のみ更新してカレンダー反映
        if (rowObj["天気1"] !== w1 || rowObj["天気2"] !== w2 || rowObj["天気3"] !== w3) {
          sheet.getRange(i + 1, colMap["天気1"]).setValue(w1);
          sheet.getRange(i + 1, colMap["天気2"]).setValue(w2);
          sheet.getRange(i + 1, colMap["天気3"]).setValue(w3);
          
          if (rowObj["イベントID"]) {
            const eventData = {
               name: rowObj["名前"],
               startTime: t1, busTime: rowObj["バス停時間"], arrTime: t2, retTime: t3,
               postal: rowObj["郵便"], address: rowObj["住所"], building: rowObj["建物"], phone: rowObj["電話"], website: rowObj["WEB"],
               bizHours: rowObj["営業時間"], holiday: rowObj["祝日"], seasonalEvent: rowObj["季節の行事"],
               icon: rowObj["アイコン"], date: rowObj["出発日"], stayTime: rowObj["滞在時間"],
               calType: rowObj["カレンダー種別"], eventId: rowObj["イベントID"],
               wStart: w1, wArr: w2, wRet: w3
            };
            createGoogleCalendarEvent(eventData);
          }
          updatedCount++;
        }
      }
    }
  }
  Logger.log(updatedCount + "件の天気を自動更新しました。");
}