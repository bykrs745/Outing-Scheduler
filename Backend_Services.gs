/**
* Backend_Services.gs
* API通信、マスタ検索、外部API(Map/Weather)などの汎用ユーティリティ群
*/

function getSettings() {
 const props = PropertiesService.getScriptProperties();
 return {
   SS_ID: props.getProperty('SS_ID') || "1L7hdXLE3JysBaxFoXXB4oe9-KeGPklT8tTr23NV-nn8",
   API_KEY: props.getProperty('PLACES_API_KEY'),
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
       "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.addressComponents,places.internationalPhoneNumber,places.websiteUri,places.regularOpeningHours",
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
       return {
         placeId: p.id,
         name: p.displayName ? p.displayName.text : "",
         address: p.formattedAddress ? p.formattedAddress.replace("日本、", "").replace(/〒?\d{3}-\d{4}\s?/, "").trim() : "",
         postal: postal,
         phone: p.internationalPhoneNumber || "登録なし",
         website: p.websiteUri || "登録なし",
         bizHours: bizHours
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
       let depStop = "宮戸橋";
       let arrStop = "目的地最寄り";

       const stepsText = leg.steps.map((s, stepIdx) => {
         if (s.transit_details) {
           const td = s.transit_details;
           const type = td.line.vehicle.type === "BUS" ? "バス" : "電車";
           if (stepIdx === 0 || !depStop || depStop === "宮戸橋") {
             depStop = td.departure_stop.name || "宮戸橋";
           }
           arrStop = td.arrival_stop.name || "目的地最寄り";
           return `${type} (${td.line.short_name || td.line.name}) [${td.departure_stop.name}  ⇨  ${td.arrival_stop.name}]`;
         }
         const walkMin = Math.ceil(s.duration.value / 60);
         if (stepIdx === 0) {
           firstWalkMinutes = walkMin;
         }
         return `徒歩 ${s.duration.text.replace("mins", "分").replace("min", "分")}`;
       }).join("\n⇩\n");

       const totalDuration = leg.duration.text.replace("mins", "分").replace("min", "分");
       const totalDistance = (leg.distance.value / 1000).toFixed(1);
       const durationMinVal = Math.ceil(leg.duration.value / 60);

       return { 
         summary: `${stepsText}\n(${totalDuration} / ${totalDistance}km)`, 
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