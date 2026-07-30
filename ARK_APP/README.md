# ARK App - Setup & Run Instructions

This is an Electron desktop app. Follow these steps to get it running on your machine. Needs node and BlackHole.

## 1 Download ARK_app Folder to get all files.

## 2 Install Node.js


- Download it from [nodejs.org](https://nodejs.org) (choose the LTS version).
- To check if you already have it, open a terminal and run:
  ```
  node -v
  npm -v
  ```
  (this gives you `npm`, required by Electron)
  If both print a version number, you're good to continue.


## 3 Open a terminal in the project folder

## 4 Install dependencies

Run:
```
npm install
```
This reads `package.json` and `package-lock.json` and downloads everything the app needs (including Electron itself).

## 5 Run the app

```
npm start
```

This launches Electron, which runs `main.js`, which opens a window and loads `index.html` (along with `style.css` and `app.js`).

## 6 Set up BlackHole 
(else audio-reactivity features won't work)

This app listens to your computer's audio which needs a virtual audio driver called BlackHole **(Mac only)**. Without this, the app won't detect any sound. 
(Set up forces output on 2 ends, BlackHole and Mac Speakers)

### Install BlackHole

1. Go to [BlackHole's website](https://existential.audio/blackhole/download/?code=2054116538) and download BlackHole 2ch.
2. Run the installer and follow the prompts
3. Restart your Mac

### Route your audio through it

You need your system audio to go to BOTH your speakers/headphones AND BlackHole at the same time, so you can still hear the music while the app listens to it.

1. Open **Audio MIDI Setup** (Command+Space midi)
2. Click the **+** button in the bottom-left corner → **Create Multi-Output Device**.
3. In the list that appears, check the box next to:
   - Your normal speakers/headphones ("MacBook Pro Speakers")
   - **BlackHole 2ch**
4. To select this or switch back to just Mac Speakers, click the servers icon to the left of the Day/Time on the top right corner of your Macbook. 
5. Then click your created audio channel.

### Confirm it's working

1. Go to the correct path where the folder is located. 
1. Launch the app (`npm start`) through the terminal 
2. Play some music (Spotify, YouTube, etc)
3. If the sphere is pulsing (Brightening + Expanding) it works.



## File overview

| File | Purpose |
|---|---|
| `package.json` | Project config, tells Electron what to run |
| `package-lock.json` | Locks exact dependency versions (used only by npm install) |
| `main.js` | Electron's entry point; creates app window |
| `index.html` | app's UI, loaded into the window |
| `style.css` | Styling for the UI |
| `app.js` | app logic  |
| `node_modules/` | Installed dependencies (auto-generated, DO NOT EDIT) |