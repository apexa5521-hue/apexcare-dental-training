/**
 * NSE migration-only exporter. Run from the owner's existing Apps Script editor,
 * not as a deployed web action. Does NOT alter the source spreadsheet.
 * Requires existing SS_ID constant from original dental-Code.gs.
 * Creates a private JSON file in the owner's Google Drive.
 */
function NSE_exportForMigration() {
  if (typeof SS_ID === "undefined" || !SS_ID) throw new Error("Missing original spreadsheet ID");
  const names = ["Specialties","Tools","Procedures","IPC_Modules","IPC_Steps","Quizzes","AssessmentBank","AssessmentConfig","Users","AssessmentResults","NurseProgress","DrillProgress","Logs"];
  const ss = SpreadsheetApp.openById(SS_ID);
  const result = {format:"NSE-legacy-sheets-v1",createdAt:new Date().toISOString(),counts:{}};
  names.forEach(function(name){
    const sheet=ss.getSheetByName(name);
    if (!sheet) { result[name]=[];result.counts[name]=0;return; }
    const values=sheet.getDataRange().getValues();
    if (!values.length) {result[name]=[];result.counts[name]=0;return;}
    const headers=values[0].map(function(x){return String(x||"").trim()});
    result[name]=values.slice(1).filter(function(row){return row.some(function(x){return x!==""&&x!==null})}).map(function(row){
      const record={};headers.forEach(function(key,i){
        if (!key || key==="password" || key==="token" || key==="passwordHash" || key==="password_hash") return;
        const v=row[i];record[key]=v instanceof Date?v.toISOString():v;
      });return record;
    });
    result.counts[name]=result[name].length;
  });
  const blob=Utilities.newBlob(JSON.stringify(result), "application/json","NSE_legacy_export_"+Utilities.formatDate(new Date(),Session.getScriptTimeZone(),"yyyyMMdd_HHmm")+".json");
  const file=DriveApp.createFile(blob);
  file.setSharing(DriveApp.Access.PRIVATE,DriveApp.Permission.NONE);
  Logger.log("NSE private export created; counts: "+JSON.stringify(result.counts));
  return {fileId:file.getId(),counts:result.counts};
}
