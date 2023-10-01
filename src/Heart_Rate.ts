//Imports
import { EventEmitter } from "events";
import noble, { Characteristic, Peripheral } from "@abandonware/noble";

//Setup the BLE Device's Name
const My_BLE_Device_Name = "HRM803";

//Setup the Heart Rate Class
export class Heart_Rate extends EventEmitter {
	//
	//Setup the Private Properties
	#Monitoring_Device: Peripheral | undefined;
	#Discovery_In_Progress: boolean;

	//Setup the Constructor
	constructor() {
		//
		//Run the Event Emitter's Constructor
		super();

		//Update the Private Properties
		this.#Discovery_In_Progress = false;

		//Listen for Discovery Events on the BLE Controller
		noble.on("discover", peripheral => this.#BLE_Discovery_Handler(peripheral));
	}

	//Monitor's the Heart Rate Data from the BLE Device
	async Monitor_Heart_Rate() {
		//
		//Check if Noble is Currently not Powered On
		if (noble.state !== "poweredOn") await this.#Wait_For_Noble_Power_On();

		//Check if Discovery is already in Progress
		if (this.#Discovery_In_Progress) return;

		//Check if the Monitoring Device does not Exist and Start Scanning for a Device
		if (!this.#Monitoring_Device) {
			//
			//Start Discovering
			await noble.startScanningAsync();

			//Update the Discovery In Progress Status
			this.#Discovery_In_Progress = true;
		}
	}

	//Waits for Noble to Power On
	async #Wait_For_Noble_Power_On(): Promise<void> {
		//
		//Setup the Interval ID for the Noble Status Checker
		let status_checker_interval: NodeJS.Timeout | null;

		//Setup the Promise
		return new Promise(Resolve_Promise => {
			//
			//Run the Interval to Check Noble's Status
			status_checker_interval = setInterval(Check_Noble_Status, 1000, Resolve_Promise);
		});

		//Setup the Function to Check the Status of Noble
		function Check_Noble_Status(Resolve_Promise: (value: void | PromiseLike<void>) => void) {
			//
			//Check if Noble is not Powered on
			if (noble.state !== "poweredOn") return;

			//Check if the Interval ID does not Exist
			if (!status_checker_interval) return;

			//Resolve the Promise
			Resolve_Promise();

			//Clear the Interval
			clearInterval(status_checker_interval);

			//Delete the Interval
			status_checker_interval = null;
		}
	}

	//Handles Discovery Events for the BLE Controller
	async #BLE_Discovery_Handler(Discovered_Peripheral: Peripheral) {
		//
		//Check if the Device's Address is not the Same as the Required Device's Address
		if (!Discovered_Peripheral.advertisement.localName.includes(My_BLE_Device_Name)) return;

		//Stop Scanning for Peripherals
		await noble.stopScanningAsync();

		//Set the Monitoring Device as the  Discovered Peripheral
		this.#Monitoring_Device = Discovered_Peripheral;

		//Update the Discovery In Progress Status
		this.#Discovery_In_Progress = false;

		//Connect to the Peripheral
		await this.#Connect_To_Peripheral(Discovered_Peripheral);
	}

	//Connects to the Device
	async #Connect_To_Peripheral(Requested_Peripheral: Peripheral) {
		//
		//Log the Connecting Status
		console.log(`${Requested_Peripheral.advertisement.localName}: connecting`);

		//Sleep for 5 Seconds to Allow time for the Connection to stabilize
		await this.#Sleeper(5);

		//Connect to the Discovered Peripheral
		await Requested_Peripheral.connectAsync();

		//Listen for Disconnect Events
		Requested_Peripheral.once(
			"disconnect",
			this.#Handle_Disconnect_Events.bind(this, Requested_Peripheral)
		);

		//Handle Connect Events for the Peripheral
		await this.#Handle_Connect_Events(Requested_Peripheral);
	}

	//Handles Disconnect Event for the Heart Rate Monitoring Device
	async #Handle_Disconnect_Events(Requested_Peripheral: Peripheral, error: Error) {
		//
		//Log the Disconnect Status
		console.log(`${Requested_Peripheral.advertisement.localName}: disconnected`);

		//Sleep for 5 Seconds to Allow time for the Connection to stabilize
		await this.#Sleeper(5);

		//Remove all connected Listeners for this Peripheral
		Requested_Peripheral.removeAllListeners();

		//Clear the Monitoring Device
		this.#Monitoring_Device = undefined;

		//Attempt to Monitor Again
		await this.Monitor_Heart_Rate();
	}

	//Handles Connect Event for the Heart Rate Monitoring Device
	async #Handle_Connect_Events(Requested_Peripheral: Peripheral) {
		//
		//Run the Connection Validation on the Peripheral (To prevent running future code if the peripheral is not connected yet)
		await this.#Validate_Connection_Status(Requested_Peripheral);

		//Log the State of the Peripheral
		console.log(`${Requested_Peripheral.advertisement.localName}: ${Requested_Peripheral.state}`);

		//Get the Peripheral's Data
		const Peripheral_Data = await Requested_Peripheral.discoverAllServicesAndCharacteristicsAsync();

		//Get the Peripheral's Service List
		const Service_List = Peripheral_Data.services;

		//Check if there are No Services
		if (Service_List.length < 1) return Requested_Peripheral.disconnect();

		//Get the Peripheral's Heart Rate Service
		const Heart_Rate_Service = Service_List.find(Service => Service.name == "Heart Rate");

		//Get the Peripheral's Battery Service
		const Battery_Service = Service_List.find(Service => Service.name == "Heart Rate");

		//Get the Peripheral's Device Information Service
		const Device_Information_Service = Service_List.find(Service => Service.name == "Heart Rate");

		//Check if the Requested Services are Invalid
		if (!Heart_Rate_Service || !Battery_Service || !Device_Information_Service) return;

		//Setup the Heart Rate Characteristic
		const Heart_Rate_Characteristic = Heart_Rate_Service.characteristics[0];

		//Setup the Event Listener to Handle Data from the Heart Rate Monitoring Device
		Heart_Rate_Characteristic.on("data", this.#Heart_Rate_Data_Handler.bind(this));

		//Let the Device Know that we are ready to Read the Data
		await Heart_Rate_Characteristic.notifyAsync(true);

		Requested_Peripheral.disconnect();
	}

	//Handles Data Events from the Heart Rate Monitoring Device
	#Heart_Rate_Data_Handler(Heart_Rate_Data: Buffer, Is_Notification: Boolean) {
		//
		//Get the Parsed Heart Rate Data
		const Parsed_Heart_Rate_Data = this.#Parse_Heart_Rate_Data(Heart_Rate_Data);

		//Emit the Heart Rate Data as an Event
		this.emit("Heart_Rate_Data", Parsed_Heart_Rate_Data);
	}

	//Parses Heart Rate Data (Buffer) to a Readable Object
	#Parse_Heart_Rate_Data(Heart_Rate_Data: Buffer): Heart_Rate_Data {
		//
		//Convert the Heart Rate Data to an Byte Array
		const Data_Byte_Array = Array.from(Uint8Array.from(Heart_Rate_Data));

		//Get the Flags Byte (as a Number)
		const Flag_Byte_Number = this.#Get_Next_From_Number_Array(Data_Byte_Array, 1);

		//Get the Raw Data Flags (in Binary String Format)
		const Raw_Data_Flags = this.#Byte_String_From_Number(Flag_Byte_Number);

		//Setup the Variable to Check if the BPM is in a 16 Bit Format
		const Is_BPM_16_Bit = this.#Get_Bit_Status(Raw_Data_Flags, 0);

		//Setup the Variable to Check if the Device detects Contact with the User
		const Is_Contact_Active = this.#Get_Bit_Status(Raw_Data_Flags, 1);

		//Setup the Variable to Check if the Contact Sensor is Supported
		const Contact_Sensor_Supported = this.#Get_Bit_Status(Raw_Data_Flags, 2);

		//Setup the Variable to Check if the Energy Expense Sensor is Supported
		const Energy_Expense_Sensor_Supported = this.#Get_Bit_Status(Raw_Data_Flags, 3);

		//Setup the Variable to Check if the RR Interval is Supported
		const RR_Supported = this.#Get_Bit_Status(Raw_Data_Flags, 4);

		//Setup the Parsed Heart Rate Data
		const Parsed_Heart_Rate_Data: Heart_Rate_Data = {
			BPM: 0,
			Contact_Status: "Not Supported",
			Energy_Expended_KJ: 0,
			RR_Interval: 0,
			Timestamp: new Date().getTime(),
		};

		//Get the Number of Bytes to get for the BPM
		const BPM_Byte_Length = Is_BPM_16_Bit ? 2 : 1;

		//Get the Number of Bytes to get for the Energy Expended
		const Energy_Expense_Byte_Length = Energy_Expense_Sensor_Supported ? 2 : 0;

		//Get the Number of Bytes to get for the RR Interval
		const RR_Byte_Length = RR_Supported ? 2 : 0;

		//Get the Heart Rate (BPM) using 2 Bytes if it is 16 bit
		const BPM = this.#Get_Next_From_Number_Array(Data_Byte_Array, BPM_Byte_Length);

		//Get the Energy Expended Amount
		const Energy_Expended_KJ = this.#Get_Next_From_Number_Array(
			Data_Byte_Array,
			Energy_Expense_Byte_Length
		);

		//Setup the RR Resolution (RR-Interval is provided with "Resolution of 1000/1024 second")
		const RR_Resolution = 1000.0 / 1024.0;

		//Get the RR Interval (RR-Interval is provided with "Resolution of 1000/1024 second")
		const RR_Interval =
			this.#Get_Next_From_Number_Array(Data_Byte_Array, RR_Byte_Length) * RR_Resolution;

		//Update the Parsed Heart Rate Data's BPM (Checking if the 8 bit or 16 bit bpm is required)
		Parsed_Heart_Rate_Data.BPM = BPM;

		//Update the Heart Rate Data's Energy Expended Amount
		Parsed_Heart_Rate_Data.Energy_Expended_KJ = Energy_Expended_KJ;

		//Update the Heart Rate Data's RR Interval
		Parsed_Heart_Rate_Data.RR_Interval = RR_Interval;

		//Check if the Contact Sensor is Supported and is Currently Inactive and Update the Contact Status
		if (Contact_Sensor_Supported && !Is_Contact_Active)
			Parsed_Heart_Rate_Data.Contact_Status = "No Contact";

		//Check if the Contact Sensor is Supported and is Currently Active and Update the Contact Status
		if (Contact_Sensor_Supported && Is_Contact_Active)
			Parsed_Heart_Rate_Data.Contact_Status = "Contact";

		//Return the Parsed Heart Rate Data
		return Parsed_Heart_Rate_Data;
		//Reference:: https://github.com/chbrown/BluetoothLE-HeartRate/blob/master/index.js
	}

	//Gets the Next x Amount of Values from a Number Array
	#Get_Next_From_Number_Array(Requested_Array: Array<number>, Amount_To_Get: number): number {
		//
		//Check if the Amount to get is Invalid
		if (Amount_To_Get < 1) return 0;

		//Setup the Byte String Array
		const Byte_String_Array: Array<Binary_Byte> = new Array();

		//Loop through the Amount of Values to get from the Array
		for (let i = 0; i < Amount_To_Get; i++) {
			//
			//Check if the Array is Empty
			if (Requested_Array.length < 0) break;

			//Get the Next Value from the Requested Array
			const Next_Value = Requested_Array.shift() || 0;

			//Get the Byte String for the Next Value
			const Next_Value_Byte_String = this.#Byte_String_From_Number(Next_Value);

			//Add the Byte String for the Next Value to the Byte String Array (Using unshift to insert them in reverse order)
			Byte_String_Array.unshift(Next_Value_Byte_String);
		}

		//Join the Byte Strings to Create a Single Byte String (8 bits = 1 byte string, 16 bits = 2 byte string's etc)
		const Joined_Byte_Strings = Byte_String_Array.join("");

		//Setup the Requested Value (This converts a binary string to a number... eg: 00001011 = 11)
		const Requested_Value = parseInt(Joined_Byte_Strings, 2);

		//Return the Requested Value
		return Requested_Value;
	}

	//Gets the Status of a Bit in a Binary Byte String
	#Get_Bit_Status(Requested_Byte_String: Binary_Byte, Requested_Bit: Binary_Bit_Index): boolean {
		//
		//Convert the Binary Byte String to a Binary Bit Array
		const Binary_Bit_Array = <Array<Binary_Bit>>Requested_Byte_String.split("");

		//Reverse the Binary Bit Array (as bits are ready from right to left so index of 0 should be index of 7)
		Binary_Bit_Array.reverse();

		//Get the Status of the Requested Bit
		const Requested_Bit_Status = Binary_Bit_Array.at(Requested_Bit) == "1";

		//Return the Requested Bit's Status
		return Requested_Bit_Status;
	}

	//Converts a Number to it's corresponding Byte (in the form of a string) !Maximum of 8 bits (1 byte)
	#Byte_String_From_Number(Requested_Number: number): Binary_Byte {
		//
		//Get the Raw Bit String
		const Raw_Bit_String = Requested_Number.toString(2);

		//Get the Bit Count (in increments of 8... eg: 8bit, 16bit, etc)
		const Bit_Count = Math.ceil(Raw_Bit_String.length / 8) * 8;

		//Get the Bit String
		const Bit_String = Raw_Bit_String.padStart(Bit_Count, "0");

		//Setup the Byte String (Creating a Full 8bit Byte if the bit count is over 8 bits)
		const Byte_String = Bit_Count == 8 ? Bit_String : String().padStart(8, "1");

		//Caste the Byte String to a Binary Byte and return it
		return <Binary_Byte>Byte_String;
	}

	//Validates the Connection Status of a Peripheral
	async #Validate_Connection_Status(Requested_Peripheral: Peripheral) {
		//
		//Setup the Connection Status Interval
		let connection_status_interval: NodeJS.Timeout | null;

		//Setup and Return the New Promise
		return new Promise(Resolve_Promise => {
			//
			//Run the Interval to Check the Requested Peripheral's Status
			connection_status_interval = setInterval(Looper, 1000, Resolve_Promise);
		});

		//Setup the Looper
		function Looper(Resolve_Promise: (value: void | PromiseLike<void>) => void) {
			//
			//Check if the Device is not Connect
			if (Requested_Peripheral.state !== "connected") return;

			//Check if the Interval does not Exist
			if (!connection_status_interval) return;

			//Resolve the Promise
			Resolve_Promise();

			//Clear the Interval
			clearInterval(connection_status_interval);

			//Delete the Interval
			connection_status_interval = null;
		}
	}

	//Sleeps for the Requested amount of Duration
	async #Sleeper(Duration_In_Seconds: number): Promise<void> {
		//
		//Setup the New Promise to be Resolved using a Set Timeout with the Requested Duration
		return new Promise(Resolve_Promise => setTimeout(Resolve_Promise, Duration_In_Seconds * 1000));
	}
}

//Setup the Heart Rate Data Type
export interface Heart_Rate_Data {
	BPM: number;
	Contact_Status: string;
	Energy_Expended_KJ: number;
	RR_Interval: number;
	Timestamp: number;
}

//Setup the Binary Bit Type
type Binary_Bit = "1" | "0";

//Setup the BinaryBit Index (0 - 7)
type Binary_Bit_Index = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

//Setup the Binary Byte Type
type Binary_Byte =
	`${Binary_Bit}${Binary_Bit}${Binary_Bit}${Binary_Bit}${Binary_Bit}${Binary_Bit}${Binary_Bit}${Binary_Bit}`;

//                                Breakdown of the Flags Byte Received from the Heart Rate Monitoring Device
// _______________________________________________________________________________________________________________________________________________
// |  Bit 8   |  Bit 7   |  Bit 6   |   Bit 5    |          Bit 4         |          Bit 3         |      Bit 2     |           Bit 1            |
// |--------------------------------|------------|------------------------|------------------------|----------------|----------------------------|
// |            Reserved            | RR Support | Energy Expense Support | Contact Sensor Support | Contact Active |  Heart Rate Value Format   |
// |--------------------------------|------------|------------------------|------------------------|----------------|----------------------------|
// |                                |  0 = False |        0 = False       |        0 = False       |    0 = False   |         0 = 8 Bit          |
// |                                |  1 = True  |        1 = True        |        1 = True        |    1 = True    |         1 = 16 Bit         |
// |________________________________|____________|________________________|________________________|________________|____________________________|
