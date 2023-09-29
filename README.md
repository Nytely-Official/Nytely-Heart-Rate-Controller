# Nytely Heart Rate Controller

## A Bluetooth Low Energy (BLE) Heart Rate Monitoring App

This Node.js application allows you to connect to a Bluetooth Low Energy (BLE) heart rate monitoring device and read heart rate data from it. The app uses the `@abandonware/noble` library for BLE communication.

## Installation

Before running the application, make sure you have Node.js installed on your system. You can download it from [nodejs.org](https://nodejs.org/).

1. Clone this repository to your local machine:

   ```shell
    git clone https://github.com/your-username/your-repo.git
   ```

2. Navigate to the project directory:

   ```shell
    cd your-repo
   ```

3. Install the required dependencies:

   ```shell
    npm install
   ```

## Usage

To use this application, follow these steps:

1. Ensure your Bluetooth adapter is enabled and your BLE heart rate monitoring device is in proximity.

2. Run the application:

   ```shell
    npm run start
   ```

3. The app will start scanning for BLE devices with the name "HRM803" (you can change this in the code if needed).

4. Once the app discovers the specified device, it will connect to it and begin monitoring the heart rate data.

5. Heart rate data will be received and logged to a JSON file (`Heart_Rate_Data/HRD<timestamp>.json`) in the project directory.

6. You can access the data from the web server at [http://localhost:3000](http://localhost:3000).

## Code Structure

### `app.ts`

This file contains the main application code. It sets up the Express web server, WebSocket communication using Socket.io, and handles BLE device discovery and data logging.

### `Heart_Rate.ts`

This file defines the `Heart_Rate` class, responsible for managing the BLE communication with the heart rate monitoring device. It includes methods for connecting to the device, handling heart rate data, and parsing the received data.

## Dependencies

- `express`: Web framework for creating the server.
- `socket.io`: Library for WebSocket communication.
- `@abandonware/noble`: A Node.js BLE (Bluetooth Low Energy) library for interacting with BLE devices.

## Contributing

Feel free to contribute to this project by opening issues or creating pull requests. Your feedback and contributions are welcome!

## License

This project is licensed under the MIT License. See the `LICENSE`(LICENSE) file for details.
