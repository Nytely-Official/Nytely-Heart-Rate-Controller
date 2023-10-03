//
//Setup the Socket Client
const Socket_Client = io();

//Listen for Heart Rate Data
Socket_Client.on(`Heart_Rate_Data`, Heart_Rate_Data => {
	//
	//Get the Current BPM Element
	const Current_BPM_Element = document.querySelector(".current_bpm");

	if (!Current_BPM_Element) throw new Error("Current BPM Element is Undefined");

	//Get the Current BPM
	const Current_BPM = Heart_Rate_Data.BPM;

	//Get the Current RR Interval
	const Current_RR_Interval = Heart_Rate_Data.RR_Interval;

	//Get the Current Contact Status
	const Current_Contact_Status = Heart_Rate_Data.Contact_Status;

	//Check if the Heart Rate Sensor is not making Contact
	if (Current_Contact_Status !== "Contact") {
		//
		//Update the Current BPM to be Empty
		Current_BPM_Element.innerText = "";

		//End the Script
		return;
	}

	//Update the BPM
	Current_BPM_Element.innerText = Current_BPM;
});
