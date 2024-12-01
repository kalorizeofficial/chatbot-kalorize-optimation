FROM node:20.1.0

# Install Python and pip
RUN apt-get update && apt-get install -y python3 python3-pip

# Create an alias for python3 to be accessible as python
RUN ln -s /usr/bin/python3 /usr/bin/python

# Install Python dependencies (requests)
RUN pip3 install requests

# Set working directory to /app 
WORKDIR /app

# Copy package.json to /app
COPY package*.json ./

# Copy all files to the working directory
COPY . .

# Run npm install to install Node.js dependencies
RUN npm install

# Expose port 3000
EXPOSE 3000

# Run the app
CMD ["npm", "start"]
