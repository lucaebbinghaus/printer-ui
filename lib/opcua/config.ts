// lib/opcua/config.ts
export const OPCUA_ENDPOINT =
  process.env.OPCUA_ENDPOINT || "opc.tcp://printer1.local:4840";

/**
 * Diese NodeIds/MethodIds musst du 1x aus UAExpert kopieren
 * und hier eintragen. Names sind Beispiele.
 */
export const NODES = {
  deviceStatus: process.env.OPCUA_NODE_DEVICE_STATUS || "ns=2;s=Device.Status",
  mediaStatus: process.env.OPCUA_NODE_MEDIA_STATUS || "ns=2;s=Media.Status",
  headStatus: process.env.OPCUA_NODE_HEAD_STATUS || "ns=2;s=Printhead.Status",
  ribbonStatus: process.env.OPCUA_NODE_RIBBON_STATUS || "ns=2;s=Ribbon.Status",

  // Job Nodes (wenn vorhanden):
  jobState: process.env.OPCUA_NODE_JOB_STATE || "ns=2;s=Job.Current.State",
  jobPrinted: process.env.OPCUA_NODE_JOB_PRINTED || "ns=2;s=Job.Current.LabelsPrinted",
  jobRemaining: process.env.OPCUA_NODE_JOB_REMAINING || "ns=2;s=Job.Current.LabelsRemaining",
  jobTotal: process.env.OPCUA_NODE_JOB_TOTAL || "ns=2;s=Job.Current.TotalLabels",
};

export const METHODS = {
  // Objekt auf dem die Methoden liegen (z.B. LabelSet / JobSet)
  labelServiceObject:
    process.env.OPCUA_OBJ_LABEL_SERVICE || "ns=2;s=LabelService",

  // Methoden-NodeIds:
  loadLabel:
    process.env.OPCUA_METH_LOAD_LABEL || "ns=2;s=LabelService.LoadLabel",
  setFieldValue:
    process.env.OPCUA_METH_SET_FIELD || "ns=2;s=LabelService.SetFieldValue",
  print:
    process.env.OPCUA_METH_PRINT || "ns=2;s=LabelService.Print",
  abort:
    process.env.OPCUA_METH_ABORT || "ns=2;s=JobService.Abort",
};
