import { CallAutomationClient } from "@azure/communication-call-automation";

const connectionString = process.env.ACS_CONNECTION_STRING;
if (!connectionString) {
  throw new Error("ACS_CONNECTION_STRING is not set in environment variables");
}

// Singleton ACS client — reused across all requests
const acsClient = new CallAutomationClient(connectionString);

export default acsClient;
