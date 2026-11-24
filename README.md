# Conspyramid

A silly alien PvP pyramid-building game. See [DESIGN.md](DESIGN.md).

## Play the prototype
Open the folder with a local web server, then visit http://localhost:8000:

```
python -m http.server 8000
```

Landscape troop battle vs a bot (2:30). Spend mana on troops that fetch stone, your pyramid builds itself, and your Saucer casts Abduct and Explode.

## Play a friend online

Tap **👫 Play a friend** on the home screen, then send the link to your friend. When they open it, the battle starts.
Your game runs the match and streams it to theirs over WebRTC ([PeerJS](https://peerjs.com/)), so no game server is needed.
- **Online:** play at https://codeperson777.github.io/Conspyramid/ (uses PeerJS / WebRTC, needs internet).
- **Same Wi-Fi, no internet needed:** run `python server.py`. It prints an address like `http://192.168.68.57:8000/`.
  Open that on both devices, tap Play a friend, and send the link. Matches go through the server on your computer.
