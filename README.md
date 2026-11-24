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
The link only works for someone else once the game is hosted on the web (a `localhost` link only works on your own computer).
