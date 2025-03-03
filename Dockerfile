# Use a Node.js base image
FROM node:14-slim

# Install required packages for Emscripten
RUN apt-get update && apt-get install -y \
    git \
    cmake \
    python3 \
    python3-pip \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*  

# Clone the Emscripten SDK and install it
RUN git clone https://github.com/emscripten-core/emsdk.git /emsdk \
    && cd /emsdk \
    && ./emsdk install latest \
    && ./emsdk activate latest \
    && echo "source /emsdk/emsdk_env.sh" >> ~/.bashrc

# Create necessary directories
RUN mkdir -p /app/uploads /app/output

# Set the working directory to /app
WORKDIR /app

# Copy the web interface files into the container
COPY web-interface/index.html ./index.html
COPY web-interface/compile.js ./compile.js

# Initialize the Node.js project and install dependencies
RUN npm init -y && npm install --production express multer archiver

# Expose the port that the application listens on
EXPOSE 8080

# Set the command to run the server and source Emscripten environment
CMD ["bash", "-c", "source /emsdk/emsdk_env.sh && node compile.js"]
