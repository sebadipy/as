/**
 * backend.gs
 * Código de Google Apps Script para el Asistente Inteligente de Impuestos.
 * Copia y pega este código en tu editor de extensiones de Apps Script en Google Sheets.
 */

function doGet(e) {
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
  
  return ContentService.createTextOutput(JSON.stringify({
    status: 'error',
    message: 'Acción POST no válida'
  })).setMimeType(ContentService.MimeType.JSON);
}
