/**
 * backend.gs
 * Código de Google Apps Script para el Asistente Inteligente de Impuestos.
 * Copia y pega este código en tu editor de extensiones de Apps Script en Google Sheets.
 */

function doGet(e) {
  // Si se pide una página HTML, servirla
  const page = (e && e.parameter && e.parameter.page) ? e.parameter.page : '';
  
  if (page === 'limpieza') {
    return HtmlService.createHtmlOutputFromFile('limpieza')
      .setTitle('Gestión de Limpieza')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1.0')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  // Modo API (datos JSON)
  const action = e.parameter.action;
  const sheetName = e.parameter.sheetName || "BD ASISTENTE";
  const doc = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = doc.getSheetByName(sheetName);
  
  if (!sheet) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: 'No se encontró la hoja "' + sheetName + '"'
    })).setMimeType(ContentService.MimeType.JSON);
  }
  
  if (action === 'read') {
    const dataRange = sheet.getDataRange();
    const values = dataRange.getValues();
    const headers = values[0];
    const rows = [];
    
    for (let i = 1; i < values.length; i++) {
      const rowObj = {};
      for (let j = 0; j < headers.length; j++) {
        rowObj[headers[j]] = values[i][j];
      }
      rows.push(rowObj);
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      status: 'success',
      headers: headers,
      data: rows
    })).setMimeType(ContentService.MimeType.JSON);
  }
  
  if (action === 'updateCell') {
    const mes = e.parameter.mes;
    const columna = e.parameter.columna;
    const montoStr = e.parameter.monto;
    let monto = parseFloat(montoStr);
    
    const dataRange = sheet.getDataRange();
    const values = dataRange.getValues();
    const headers = values[0];
    
    // Buscar la columna (sin importar espacios ni mayúsculas/minúsculas)
    let colIdx = -1;
    for (let j = 0; j < headers.length; j++) {
      if (headers[j].toString().trim().toLowerCase() === columna.toString().trim().toLowerCase()) {
        colIdx = j;
        break;
      }
    }
    
    // Buscar la fila del Mes
    let rowIdx = -1;
    for (let i = 1; i < values.length; i++) {
      if (values[i][0].toString().trim().toLowerCase() === mes.toString().trim().toLowerCase()) {
        rowIdx = i;
        break;
      }
    }
    
    if (colIdx === -1) {
      return ContentService.createTextOutput(JSON.stringify({
        status: 'error',
        message: 'No se encontró la columna de servicio: "' + columna + '"'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    if (rowIdx === -1) {
      return ContentService.createTextOutput(JSON.stringify({
        status: 'error',
        message: 'No se encontró la fila del mes: "' + mes + '"'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // Formatear valor
    let finalValue = monto;
    if (typeof montoStr === 'string' && montoStr.toLowerCase().startsWith('p ')) {
      finalValue = montoStr;
    } else if (montoStr === "" || montoStr === "-" || monto === 0 || monto === null || monto === undefined || isNaN(monto)) {
      finalValue = "-";
    }
    
    // Escribir en la celda (1-indexed en Google Sheets)
    sheet.getRange(rowIdx + 1, colIdx + 1).setValue(finalValue);
    
    return ContentService.createTextOutput(JSON.stringify({
      status: 'success',
      message: 'Celda actualizada con éxito (' + mes + ' -> ' + columna + ' = ' + finalValue + ')'
    })).setMimeType(ContentService.MimeType.JSON);
  }
  
  return ContentService.createTextOutput(JSON.stringify({
    status: 'error',
    message: 'Acción GET no válida'
  })).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  let requestData;
  try {
    requestData = JSON.parse(e.postData.contents);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: 'JSON malformado en POST: ' + error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
  
  const action = requestData.action;
  const sheetName = requestData.sheetName || "BD ASISTENTE";
  const doc = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = doc.getSheetByName(sheetName);
  
  if (!sheet) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: 'No se encontró la hoja "' + sheetName + '"'
    })).setMimeType(ContentService.MimeType.JSON);
  }
  
  if (action === 'updateCell') {
    const mes = requestData.mes;
    const columna = requestData.columna;
    const monto = requestData.monto;
    
    const dataRange = sheet.getDataRange();
    const values = dataRange.getValues();
    const headers = values[0];
    
    // Buscar la columna (sin importar espacios ni mayúsculas/minúsculas)
    let colIdx = -1;
    for (let j = 0; j < headers.length; j++) {
      if (headers[j].toString().trim().toLowerCase() === columna.toString().trim().toLowerCase()) {
        colIdx = j;
        break;
      }
    }
    
    // Buscar la fila del Mes
    let rowIdx = -1;
    for (let i = 1; i < values.length; i++) {
      if (values[i][0].toString().trim().toLowerCase() === mes.toString().trim().toLowerCase()) {
        rowIdx = i;
        break;
      }
    }
    
    if (colIdx === -1) {
      return ContentService.createTextOutput(JSON.stringify({
        status: 'error',
        message: 'No se encontró la columna de servicio: "' + columna + '"'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    if (rowIdx === -1) {
      return ContentService.createTextOutput(JSON.stringify({
        status: 'error',
        message: 'No se encontró la fila del mes: "' + mes + '"'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // Formatear valor: si está vacío o es cero, poner guión "-" o vacío, si no, el monto numérico
    let finalValue = monto;
    if (typeof monto === 'string' && monto.toLowerCase().startsWith('p ')) {
      finalValue = monto;
    } else if (monto === 0 || monto === "" || monto === null || monto === undefined || isNaN(monto)) {
      finalValue = "-";
    }
    
    // Escribir en la celda (1-indexed en Google Sheets)
    sheet.getRange(rowIdx + 1, colIdx + 1).setValue(finalValue);
    
    return ContentService.createTextOutput(JSON.stringify({
      status: 'success',
      message: 'Celda actualizada con éxito (' + mes + ' -> ' + columna + ' = ' + finalValue + ')'
    })).setMimeType(ContentService.MimeType.JSON);
  }
  
  if (action === 'saveCleaningRow') {
    const rowData = requestData.rowData;
    if (!rowData) {
      return ContentService.createTextOutput(JSON.stringify({
        status: 'error',
        message: 'No se enviaron datos (rowData)'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // La tabla BD AS_LIMPIEZA solo admite un solo registro, el cual se actualiza en la fila 2.
    const targetRowIdx = 2; 
    
    const dataRange = sheet.getDataRange();
    const values = dataRange.getValues();
    const headers = values[0];
    
    // Helper function to normalize keys
    function normalize(s) {
      if (!s) return "";
      return String(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
    }
    
    // Build an array for row 2 based on headers
    const newRowValues = [];
    for (let j = 0; j < headers.length; j++) {
      const headerNorm = normalize(headers[j]);
      let foundValue = ""; 
      
      // Find matching key in rowData
      for (const key in rowData) {
        if (normalize(key) === headerNorm) {
          foundValue = rowData[key];
          
          // Formateo especial para booleanos
          if (typeof foundValue === 'boolean') {
             foundValue = foundValue ? "TRUE" : "FALSE";
          }
          break;
        }
      }
      
      // If we are updating and a field was not found in rowData, 
      // we might want to keep the old value if it existed in row 2.
      if (foundValue === "" && values.length >= 2 && values[1][j] !== undefined) {
          // If rowData didn't have this column, but the sheet did, keep existing value
          // Only if it's strictly not provided (we initialized foundValue to "").
          // But actually, we map everything from the form.
      }
      
      newRowValues.push(foundValue);
    }
    
    // Write the row 2
    sheet.getRange(targetRowIdx, 1, 1, headers.length).setValues([newRowValues]);
    
    return ContentService.createTextOutput(JSON.stringify({
      status: 'success',
      message: 'Registro de limpieza actualizado en fila 2'
    })).setMimeType(ContentService.MimeType.JSON);
  }
  
  return ContentService.createTextOutput(JSON.stringify({
    status: 'error',
    message: 'Acción POST no válida'
  })).setMimeType(ContentService.MimeType.JSON);
}
