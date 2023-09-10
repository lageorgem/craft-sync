# Craft Sync

Craft Sync is a utility for synchronizing files across different clients. This repository includes both the client and the server. The client connects to the server via websockets, advertises the local file list, and uses the file differences from the server to determine whether to download or upload files.

## Structure

- **Client**: Watches for file changes, makes HTTP requests, and manages websocket connections.
- **Server**: Built with NestJS, it interfaces with AWS S3 for file storage and offers websocket-based communication for synchronization.

## Getting Started

### Prerequisites

Ensure you have [Node.js](https://nodejs.org/) 18 or newer installed.

### Installation

1. Clone the repository:
   `git clone https://github.com/your-repo-url/craft-sync.git`

2. Navigate to the project directory:
   `cd craft-sync`

3. Install dependencies for the client:
   `cd client && npm install`

4. Install dependencies for the server:
   `cd server && npm install`


### Usage

#### **Server:**

To build and start the server:

1. Build the project:
   'npm run build'

2. Start the server:
   'npm run start'

#### **Client:**

In the `client` directory, run the craft sync client utility:
`npm run craft-sync`

## Development

### Client:

- **ts-node**: For running TypeScript files directly.
- **typescript**: For type checking.

### Server:

- **NestJS**: The server is built using NestJS, a progressive Node.js framework.
- **AWS S3**: Files are stored in AWS S3.
- **Jest**: Used for testing.

## License

This project is unlicensed.
