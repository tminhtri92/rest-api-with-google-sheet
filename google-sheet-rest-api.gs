var SHEET_ID = "<YourSheetId>";
var PASSWORD_ENCRYPT = "COUPLETX2020";
// Get a script lock, because we're about to modify a shared resource.
var lock = LockService.getScriptLock();

/*
* Lock Requests
*/
function lockReq() {
  // Wait for up to for other processes to finish.
  lock.waitLock(30000);
}

/* 
* Release Lock Requests
*/
function releaseLockReq() {  
  // Release the lock so that other processes can continue.
  lock.releaseLock();
}

/* 
* GET Requests
*/
function doGet( req ) {
  lockReq();
  var action    = req.parameter.action;
  var table_req = req.parameter.table;
  
  var db    = SpreadsheetApp.openById( SHEET_ID );
  var table = db.getSheetByName( table_req );
  
  switch(action) {
    case "read":
      return Read( req, table );
      break;
    case "insert":
      return Insert( req, table );
      break;
    case "update":
      return Update( req, table );
      break;
    case "delete":
      return Delete( req, table );
      break;
    case "getprize":
      return GetPrize(req);
      break;
    default:
      break;
  }
}

/* 
* Test case
*/
function test() {
  var param = {
    parameter: {
      phone: "123456",
      email: "3124124@dfwerwer"
    }
  }
  GetPrize(param)
}


/* GetPrize method
* dynamic for 1 main table and prize table
*
* @parameter action=getprize
* @parameter phone=<phone number>
* @parameter email=<email>
* 
* @example-request | ?action=getprize&phone=0909123456&email=test@gmail.com
*/
function GetPrize(request) {
  var db    = SpreadsheetApp.openById( SHEET_ID );
  var table, data;
  var request_phone = request.parameter.phone;
  var request_email = request.parameter.email;
  var now = new Date();
  var main_table = db.getSheetByName("Sheet1");
  var prizeId = randomPrize();
  switch(prizeId.name) {
    case "Voucher100k":
      table = db.getSheetByName("voucher100k");
      data = UpdatePrize( table );
      break;
    case "Voucher50k":
      table = db.getSheetByName("voucher50k");
      data = UpdatePrize( table );
      break;
    default:
      data = false;
      break;
  }
  return CheckPrizeAndReturnRespone(data, main_table, table, request_phone, request_email, now, prizeId);
}

/* Find and update prize
* dynamic for all tables
*
* 
*/
function UpdatePrize( table ) {
  var data = _read( table );
  var length = Object.keys(data).length;
  for (var i=0; i<=length-1; i++) {
    if(!data[i].use) {
      var param = {
        parameter: {
          id:i+1,
          data: '{"use": "1"}'
        }
      }
      return Update( param,table );
    }
  }
  return false;
}

function CheckPrizeAndReturnRespone( data, main_table, table, request_phone, request_email, now, prizeId ) {
 if (!data) {
    var tempdata = _read( main_table );
    var length = Object.keys(tempdata).length;
    var objData = {
      data: {
        row: length+1,
        name: "Không trúng thưởng"
      }
    };
    var result = {};  
    var param = {
      parameter: {
        data: `{"id": "${objData.data.row}", "phone": "${request_phone}","email": "${request_email}", "prize": "${objData.data.name}", "voucher": "null", "time": "${now}"}`
      }
     }
    Insert(param,main_table);
    var result = {};
    result.successs = true;
    result.data = {
      prizeId: 3,
    };
    releaseLockReq();
    return response().json( result );
  } else {
    var tempdata = _read( main_table );
    var length = Object.keys(tempdata).length;
    var objData = JSON.parse(data.getContent());
    var result = {};  
    var param = {
      parameter: {
        data: `{"id": "${length + 1}", "phone": "${request_phone}","email": "${request_email}", "prize": "${prizeId.name}", "voucher": "${objData.data.name}", "time": "${now}"}`
      }
     }
    Insert(param,main_table);
    var result = {};
    result.successs = true;
    result.data = {
      prizeId: prizeId.id,
      voucher: encrypt(prizeId.name)
    };
    releaseLockReq();
    return response().json( result );
  }
}

/* Read
* request for all tables
*
* @parameter action=read
* @parameter table=<TABLE_NAME>
* @parameter id=<COLUMN_ID>
*
* @example-request | ?action=read&table=<TABLE_NAME>
* @example-request-single-row | ?action=read&table=<TABLE_NAME>&id=<ROW_NUMBER>
*/
function Read( request, table ) {
  var request_id = Number( request.parameter.id );
  lock.releaseLock();
  return response().json({
    success: true,
    data: _read( table, request_id )
  });
  
}

/* Insert
* dynamic for all data
*
* @parameter action=insert
* @parameter table=<TABLE_NAME>
* @parameter data=JSON
*  
* @example-request | ?action=insert&table=<TABLE_NAME>&data={"name":"John Doe"}
*/
function Insert( request, table ) {
  var errors = [];
  
  var last_col     = table.getLastColumn();
  var first_row    = table.getRange(1, 1, 1, last_col).getValues();
  var headers      = first_row.shift();
  var data         = JSON.parse( request.parameter.data );
  var new_row;
  var result = {};  
  
  try {
    new_row = prepareRow( data, headers );
    table.appendRow( new_row );
    
    result.success = true;
    result.data = data;
    
  } catch ( error ) {
    result.success = false;
    result.data = error;
  }
  return response().json( result );
}

/* Update
* dynamic for all tables
*
* @parameter action=update
* @parameter table=<TABLE_NAME>
* @parameter id=<COLUMN_ID>
* @parameter data=JSON
* 
* @example-request | ?action=update&table=<TABLE_NAME>&id=<ID>&data={"col_to_update": "value" }
*/
function Update( request, table ) {
  var last_col      = table.getLastColumn();
  var first_row     = table.getRange(1, 1, 1, last_col).getValues();
  var headers       = first_row.shift();
  
  var request_id    = Number( request.parameter.id );
  var current_data  = _read( table, request_id );
  var data          = JSON.parse( request.parameter.data );
  
  var result = {};
  
  try {
    var current_row   = current_data.row;
    for( var object_key in data ) {
      var current_col = headers.indexOf( object_key ) + 1;
      table.getRange( current_row, current_col ).setValue( data[ object_key ]); // update iteratively
      current_data[ object_key ] = data[ object_key ]; // update for response;
    }
    result.successs = true;
    result.data = current_data;
  } catch ( error ) {
    result.success = false;
    result.data = error;
  }
  return response().json( result );
}

/* Delete
* dynamic for all tables
*
* @parameter action=delete
* @parameter table=<TABLE_NAME>
* @parameter id=<COLUMN_ID>
* 
* @example-request | ?action=update&table=<TABLE_NAME>&id=<ID>
*/
function Delete( request, table ) {
  var request_id    = Number( request.parameter.id );
  var current_data  = _read( table, request_id );
  
  // delete
  table.deleteRow( current_data.row );
  
  return response().json({
    success: true,
    data: current_data
  });
}

/**
* Build the response content type 
* back to the user
*/
function response() {
  return {
    json: function(data) {
      return ContentService
      .createTextOutput(JSON.stringify(data))
      .setMimeType(ContentService.MimeType.JSON);
    }
  }
}

/**
* Read from sheet and return map key-value
* javascript object
*/
function _read( sheet, id ) {
  var data         = sheet.getDataRange().getValues();
  var header       = data.shift();
  
  // Find All
  var result = data.map(function( row, indx ) {
    var reduced = header.reduce( function(accumulator, currentValue, currentIndex) {
      accumulator[ currentValue ] = row[ currentIndex ];
      return accumulator;
    }, {});
    
    reduced.row = indx + 2;
    return reduced;
    
  });
  
  // Filter if id is provided
  if( id ) {
    var filtered = result.filter( function( record ) {
      if ( record.id === id ) {
        return true;
      } else {
        return false;
      }
    });
    
    return filtered.shift();
  } 
  
  return result;
  
}

/*
* Prepare row with correct order to insert into
* sheet.
* 
* @throws Error
*/
function prepareRow( object_to_sort, array_with_order ) {
  var sorted_array   = [];
  
  for( var i=0; i<array_with_order.length; i++ ) {
    var value = object_to_sort[ array_with_order[ i ]];
    
    if( !value ) {
      throw new Error( "The attribute/column <" + array_with_order[i] + "> is missing." );
    } else {
      sorted_array[i] = value;      
    }
  }
  
  return sorted_array;
}

/*
* Modify ratio reward
*  
*/
function randomPrize() {
  const users = [
    {id: 1, name: "Voucher100k", pct: 20},
    {id: 2, name: "Voucher50k", pct: 20},
    {id: 3, name: "Không trúng thưởng", pct: 60}
  ];
  
  const expanded = users.flatMap(user => Array(user.pct).fill(user));
  const winner = expanded[Math.floor(Math.random() * expanded.length)];
  Logger.log("winner: " + winner.name);
  return {
    id: winner.id,
    name: winner.name,
  };
}

/*
* Setup Encrypt
*  
*/
function encrypt(str) {
  var cipher = new cCryptoGS.Cipher(PASSWORD_ENCRYPT, 'aes');
  var encryptedMessage = cipher.encrypt (str);
  var decryptedMessage = cipher.decrypt (encryptedMessage);
  Logger.log (encryptedMessage);
  Logger.log (decryptedMessage);
  return encryptedMessage;
}