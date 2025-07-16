# Astro: Group Assignment

1. Open your folder you want then clone this project

```sh
git clone https://github.com/BadLuckZ/Study-ILP-Model.git
```

2. Go inside this project then install packages

```sh
npm install
```

3. Run...

```sh
cd ilp-api
pip install fastapi uvicorn
uvicorn main:app --reload
```

If hitting the submit button and the model thinks for a while without giving a result, It's probably one of these things:

- The problem might have too many possible ways to check.
- The problem is impossible so it explodes itself.
- It's gone into "hallucination mode" I dunno why.

A restart in this terminal usually solve it. `Ctrl+C` in the terminal running uvicorn, and then run `uvicorn main:app --reload` again.

4. Open another terminal at root directory then run...

```sh
npm run dev
```
