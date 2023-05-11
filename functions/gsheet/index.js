/*
 * prerequisites
 */
if (!process.env.NETLIFY) {
  // get local env vars if not in CI
  // if in CI i expect its already set via the Netlify UI
  require('dotenv').config();
}

// required env vars
if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL)
  throw new Error('no GOOGLE_SERVICE_ACCOUNT_EMAIL env var set');
if (!process.env.GOOGLE_PRIVATE_KEY)
  throw new Error('no GOOGLE_PRIVATE_KEY env var set');
if (!process.env.GOOGLE_SPREADSHEET_ID_FROM_URL)
  // spreadsheet key is the long id in the sheets URL
  throw new Error('no GOOGLE_SPREADSHEET_ID_FROM_URL env var set');

/*
 * ok real work
 *
 * GET /.netlify/functions/gsheet
 *
 * the library also allows working just with cells,
 * but this example only shows CRUD on rows since thats more common
 */
const { GoogleSpreadsheet } = require('google-spreadsheet');

exports.handler = async (event, context) => {
  const UserIP = event.headers['x-nf-client-connection-ip'] || '6.9.6.9';
  const doc = new GoogleSpreadsheet(process.env.GOOGLE_SPREADSHEET_ID_FROM_URL);

  await doc.useServiceAccountAuth({
    client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n')
  });
  await doc.loadInfo();
  
  let sheet = doc.sheetsByIndex[0];
  const path = event.path.replace(/\.netlify\/functions\/[^/]+/, '');
  const segments = path.split('/').filter((e) => e);
  if (segments.length === 1 && segments[0] in doc.sheetsByTitle) {
    sheet = doc.sheetsByTitle[segments[0]];
  }

  try {
    switch (event.httpMethod) {
      case 'GET':
        /* GET /.netlify/functions/gsheet */
        const rows = await sheet.getRows(); // can pass in { limit, offset }
        let serializedRows = rows.map(serializeRow);
        return {
          statusCode: 200,
          body: JSON.stringify(serializedRows),
          headers: {
            'Access-Control-Allow-Credentials': true,
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json',
          },
        };
      default:
        return {
          statusCode: 500,
          body: 'unrecognized HTTP Method, must be one of GET/POST/PUT/DELETE'
        };
    }
  } catch (err) {
    console.error('error ocurred in processing ', event);
    console.error(err);
    return {
      statusCode: 500,
      body: err.toString()
    };
  }

  /*
   * utils
   */
  function serializeRow(row) {
    let temp = {};
    sheet.headerValues.map((header) => {
      temp[header] = row[header];
    });
    return temp;
  }
};
