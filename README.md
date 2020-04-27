# Spool
Spool is a framework for creating socket.io based multiplayer games

## Getting started 

Spool requires node.js, express, socket.io and more

For installation follow this simple steps:
1. install node.js 
2. create your folder and add spool as git submodule in spool directory and move to said directory
```
git submodule add https://github.com/sixkey/spool.git spool
cd spool
```
3. run npm install
```
npm install
```
4. install nodemon with -g so you can use it in terminal
```
npm install -g nodemon
```
5. move to your folder
```
cd..
```
6. create your testing server (example: text-server.js)
7. run it using nodemon
```
nodemon test-server.js
```
7. check the port in your console 
8. open localhost:(port from console) on your browser of choice
