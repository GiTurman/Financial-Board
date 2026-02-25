
import * as XLSX from 'xlsx';
import { ExpenseRequest } from '../types';

// Helper to generate a standardized filename with the current date
const generateFilename = (baseName: string): string => {
  const date = new Date();
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${baseName}_${day}_${month}_${year}.xlsx`;
};

/**
 * A generic function to export an array of data to an Excel file with optional totals and freeze panes.
 * @param data The array of objects to export.
 * @param headers A key-value map where the key is the object property and the value is the desired Excel column header.
 * @param sheetName The name of the worksheet.
 * @param fileNameBase The base name for the exported file (date will be appended).
 * @param totals An optional object containing the summary totals to be added at the end.
 */
export const exportGenericToExcel = (
  data: any[], 
  headers: Record<string, string>, 
  sheetName: string, 
  fileNameBase: string,
  totals?: Record<string, any> // PROMPT 6.1-005: Add totals parameter
) => {
  if (!data || data.length === 0) {
    alert("ექსპორტისთვის მონაცემები არ მოიძებნა.");
    return;
  }

  const headerKeys = Object.keys(headers);

  // Map data to use the specified headers
  const formattedData = data.map(item => {
    const row: Record<string, any> = {};
    for (const key of headerKeys) {
      let value = item[key];
      // Simple date formatting for Excel
      if (value instanceof Date || (typeof value === 'string' && !isNaN(Date.parse(value)) && new Date(value).getFullYear() > 1990)) {
        const d = new Date(value);
        value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      }
      row[headers[key]] = value !== undefined ? value : '';
    }
    return row;
  });

  // PROMPT 6.1-005: Add totals row if provided
  if (totals) {
    formattedData.push({}); // Add a blank row for separation
    const totalsRow: Record<string, any> = {};
    const totalKeys = Object.keys(totals);
    
    // Set label in the first column
    totalsRow[headers[headerKeys[0]]] = 'ჯამი';

    for(const key of headerKeys) {
        if(totalKeys.includes(key)) {
            totalsRow[headers[key]] = totals[key];
        }
    }
    formattedData.push(totalsRow);
  }

  const worksheet = XLSX.utils.json_to_sheet(formattedData);
  
  // PROMPT 6.1-005: Add Freeze Panes
  worksheet['!freeze'] = { xSplit: 1, ySplit: 1, state: 'frozen' };

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  XLSX.writeFile(workbook, generateFilename(fileNameBase));
};

// Refactor the original function to use the new generic one for consistency
export const exportToExcel = (data: ExpenseRequest[], fileName: string) => {
  const headers = {
    'id': 'ID',
    'createdAt': 'თარიღი',
    'department': 'დეპარტამენტი',
    'requesterName': 'მომთხოვნი',
    'category': 'კატეგორია',
    'itemName': 'ხარჯის დასახელება',
    'description': 'აღწერა (DTSQ)',
    'quantity': 'რაოდენობა',
    'unitPrice': 'ერთეულის ფასი',
    'currency': 'ვალუტა',
    'totalAmount': 'ჯამური თანხა',
    'priority': 'პრიორიტეტი',
    'revenuePotential': 'შემოსავლის პოტენციალი',
    'alternativesChecked': 'ბაზრის მოკვლევა',
    'selectedOptionReason': 'შერჩევის მიზეზი',
    'status': 'სტატუსი',
    'directorNote': 'დირექტორის გადაწყვეტილება',
    'finDirectorNote': 'ფინანსური დირექტორის გადაწყვეტილება',
    'discussionResult': 'განხილვის შედეგი'
  };

  const processedData = data.map(item => ({
    ...item,
    priority: item.priority === 3 ? 'High' : item.priority === 2 ? 'Medium' : 'Low',
    alternativesChecked: item.alternativesChecked ? 'კი' : 'არა'
  }));

  exportGenericToExcel(processedData, headers, 'Report', fileName);
};

// FIX: Add missing multi-sheet export function for Board Closure report
export const exportMultiSheetExcel = (
  sheets: { data: any[], headers: Record<string, string>, sheetName: string }[],
  fileNameBase: string
) => {
  const workbook = XLSX.utils.book_new();
  
  sheets.forEach(sheetInfo => {
    const headerKeys = Object.keys(sheetInfo.headers);
    const formattedData = sheetInfo.data.map(item => {
      const row: Record<string, any> = {};
      for (const key of headerKeys) {
        row[sheetInfo.headers[key]] = item[key] !== undefined ? item[key] : '';
      }
      return row;
    });
    
    const worksheet = XLSX.utils.json_to_sheet(formattedData);
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetInfo.sheetName);
  });
  
  XLSX.writeFile(workbook, generateFilename(fileNameBase));
};
