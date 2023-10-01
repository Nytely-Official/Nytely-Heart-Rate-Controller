//External Imports
import Express from "express";
import Socket from "socket.io";
import HTTP from "http";
import { writeFileSync, openSync, fstatSync, writeSync, readFileSync } from "fs";

//Internal Imports
import { Heart_Rate, Nytely_Heart_Rate_Data, Sleeper } from "./Heart_Rate";

//Setup the Heart Rate Client
const Heart_Rate_Client = new Heart_Rate();

//Setup the Connections List
const Connections_List: Map<string, Socket.Socket> = new Map();

//Setup Express
const App = Express();
const Server = HTTP.createServer(App);

//Setup Body Parser
App.use(Express.json());

//Setup the Socket Server
const Socket_Server = new Socket.Server(Server);

//Listen for Connections to the Socket Server
Socket_Server.on("connection", Socket_Connection_Handler);

//Start the Express Server.
Server.listen(3000, () => {
	//
	//Log Successful Server Start
	console.log(`Started Web Server on 3000`);
});

//Setup the Socket Connection Handler
function Socket_Connection_Handler(Connection: Socket.Socket) {
	//
	//Add the Connection to the Connections List
	Connections_List.set(Connection.id, Connection);

	//Listen for Socket Disconnect Event
	Connection.on("disconnect", () => Socket_Disconnect_Handler(Connection));

	//Listen for Any Other Connection Events
	Connection.onAny(Socket_Client_Event_Handler);
}

//Setup the Socket Disconnect Handler
function Socket_Disconnect_Handler(Connection: Socket.Socket) {
	//
	//Remove the Connection from the Connections List
	Connections_List.delete(Connection.id);
}

//Setup the TTS Page
App.get("/", (req, res) => {
	res.sendFile(`${process.cwd()}/public/index.html`);
});

//Handle Events from Socket Clients
function Socket_Client_Event_Handler(Listener: string, ...Arguments: [any]) {
	//
}

//Start Monitoring the Heart Rate
Heart_Rate_Client.Monitor_Heart_Rate();

//Setup the Heart Rate Data Path
const Heart_Rate_Data_Path = `${process.cwd()}/Heart_Rate_Data/HRD${new Date().getTime()}.json`;

//Create the Heart Rate Data File
writeFileSync(Heart_Rate_Data_Path, "");

//Open the Heart Rate Data File and get it's Descriptor (Where it is in memory to write to it)
const Heart_Rate_Data_File_Descriptor = openSync(Heart_Rate_Data_Path, "r+");

//Listen for Heart Rate Events
Heart_Rate_Client.on("Heart_Rate_Data", (Heart_Rate_Data: Nytely_Heart_Rate_Data) => {
	//
	//Send the Heart Rate Data to the Sockets
	Socket_Server.sockets.emit("Heart_Rate_Data", Heart_Rate_Data);

	//Get the Heart Rate Data File's Statistics
	const Heart_Rate_Data_File_Stats = fstatSync(Heart_Rate_Data_File_Descriptor);

	//Setup the File Offset (-1 To overwrite the Last Character in the File and using Math.max to prevent going under the minimum)
	const Heart_Rate_Data_File_Offset = Math.max(0, Heart_Rate_Data_File_Stats.size - 1);

	//Setup the Heart Rate Data String Variable (This will be modified to make it more usable)
	let heart_rate_data_string = JSON.stringify(Heart_Rate_Data);

	//Check if this file has no data and a wrap the heart rate data string into an array to initialize the first data entry
	if (Heart_Rate_Data_File_Stats.size < 1) heart_rate_data_string = `[${heart_rate_data_string}]`;

	//Check if this file already has data and a prepend a comma to separate it from the previous entries and end it with an array end symbol
	if (Heart_Rate_Data_File_Stats.size > 0) heart_rate_data_string = `,${heart_rate_data_string}]`;

	//Setup the Heart Rate Data Buffer
	const Heart_Rate_Data_Buffer = Buffer.from(heart_rate_data_string);

	//Append the Data to the Heart Rate Data File
	writeSync(
		Heart_Rate_Data_File_Descriptor, //Get the Current File that needs to be written to
		Heart_Rate_Data_Buffer, // The Data to be Appended
		0, // The Start Point for the data you want to write (eg: [0 = apple: 1], [1 = pple: 1])
		Heart_Rate_Data_Buffer.length, // The End Point for the data you want to write (eg: [data_length = apple: 1], [data_length - 1 = apple: ])
		Heart_Rate_Data_File_Offset // Will Determine where to start writing in the file itself
	);
});

//This Replays Heart Rate Data using the Requested File Name
async function Replay_Heart_Rate_Data(File_Name: string) {
	//
	//Get the Requested File
	const Requested_File = require(`${process.cwd()}/Heart_Rate_Data/${File_Name}`);

	//Check if the Requested File is not valid
	if (!Requested_File) return;

	//Get the Requested Data from the File
	const Requested_Data = <Array<Nytely_Heart_Rate_Data>>Requested_File;

	//Check if the Requested Data is Empty
	if (Requested_Data.length < 1) return;

	//Loop through the Data
	for (const [Current_Index, Current_Heart_Rate_Data] of Requested_Data.entries()) {
		//
		//Send the Current Heart Rate Data to the Sockets
		Socket_Server.sockets.emit("Heart_Rate_Data", Current_Heart_Rate_Data);

		//Get the Next Heart Rate Data
		const Next_Heart_Rate_Data = Requested_Data.at(Current_Index);

		//Check if the Next Heart Rate Data is Invalid and End the Loop
		if (!Next_Heart_Rate_Data) break;

		//Calculate the amount of Time to wait before sending the Next Heart Rate Data
		const Wait_Period_Milliseconds =
			Current_Heart_Rate_Data.Timestamp - Next_Heart_Rate_Data.Timestamp;

		//Check if the Wait Period is Invalid and Continue to the Next Data Entry
		if (Wait_Period_Milliseconds < 1) continue;

		//Sleep for the specified Wait Period
		await Sleeper(Wait_Period_Milliseconds);

		//Continue to the Next Data Entry
		continue;
	}

	//Log the Replay as Completed
	console.log("Completed Replay");
}
