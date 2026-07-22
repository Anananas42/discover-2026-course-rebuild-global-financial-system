# Rebuild the Banks

Course project. After a global electromagnetic storm wiped out the world's
financial systems, each participant rebuilds their own country's banking
stack: a central bank, commercial banks, and payments between them.

This page takes you from a blank computer to the running project. You go
through it once; from then on you work in the project guide that
`pnpm start` opens, and this page's job is done.

## 1. Install the tools

The project needs five tools: Git, Node.js, pnpm, Docker, and Visual
Studio Code. Check each one even if it sounds familiar — the versions
matter.

### Git

Git downloads the project to your computer (and is how software teams
share code everywhere).

- **Windows**: install [Git for Windows](https://git-scm.com/download/win);
  the installer's defaults are fine. It includes **Git Bash** — a terminal
  where all the commands in this guide work as written. Use it for
  everything below.
- **macOS**: open Terminal and run `git --version`; if Git is missing,
  macOS offers to install it.
- **Linux**: install the `git` package with your distribution's package
  manager, e.g. `sudo apt install git`.

Check it worked:

```sh
git --version
```

Then tell Git your name and email — it records them with every save you
make (any email works; it just labels your saves):

```sh
git config --global user.name "Your Name"
git config --global user.email "you@example.com"
```

### Node.js — version 24 or newer

Node.js runs the project's code.

Download the installer from [nodejs.org](https://nodejs.org) — pick
version 24 or newer — and run it with default settings.

Check (must print v24 or higher):

```sh
node --version
```

### pnpm

pnpm installs the project's libraries. It comes via npm, which arrived
with Node.js:

```sh
npm install -g pnpm
```

Check:

```sh
pnpm --version
```

### Docker

Docker runs the project's database. You never work with Docker directly —
it just has to be installed and running.

- **Windows and macOS**: install
  [Docker Desktop](https://www.docker.com/products/docker-desktop/) and
  follow the installer's instructions. After installing, start Docker
  Desktop and leave it running — the project needs it every time you work.
- **Linux**: install Docker Engine following
  [docs.docker.com](https://docs.docker.com/engine/install/) for your
  distribution.

Check:

```sh
docker --version
```

### Visual Studio Code

The editor you will write your code in — the project guide has buttons
that open the right file at the right line directly in it.

Download it from [code.visualstudio.com](https://code.visualstudio.com)
and install it with default settings.

## 2. Get access to the project

The project lives on GitHub, and GitHub identifies your computer by an
SSH key — a small file pair proving it's you, no password typing.

1. Create an account at [github.com](https://github.com) if you don't
   have one.
2. In your terminal (Git Bash on Windows), generate a key — press Enter
   at every question:

   ```sh
   ssh-keygen -t ed25519
   ```

3. Print the public half and copy the whole output line (it starts with
   `ssh-ed25519`):

   ```sh
   cat ~/.ssh/id_ed25519.pub
   ```

4. On GitHub: your profile picture → **Settings** → **SSH and GPG keys**
   → **New SSH key**. Paste the copied line into the key field and save.
5. Check — the first time, type `yes` when asked whether to trust the
   host:

   ```sh
   ssh -T git@github.com
   ```

   Success looks like `Hi <your username>! You've successfully
authenticated`.

## 3. Download and start

1. On this repository's GitHub page, click the green **Code** button,
   pick **SSH**, and copy the address. Then, in the folder where you keep
   projects:

   ```sh
   git clone <the copied address>
   ```

2. Enter the folder the clone created (its name is the repository's):

   ```sh
   cd <the folder>
   ```

   From here you can also open the project in Visual Studio Code straight
   from the terminal — the dot means "this folder":

   ```sh
   code .
   ```

3. Install the project's libraries:

   ```sh
   pnpm install
   ```

4. Start:

   ```sh
   pnpm start
   ```

`pnpm start` brings up the database, starts the project, and opens the
**project guide** in your browser — introduction, tasks with live status,
test results, and your financial system. Everything from here on happens
there. Keep the command running while you work; stop it with `Ctrl+C` and
start it the same way next time. Your data lives in the database and
survives restarts.

## If something fails

- Docker errors when starting → Docker Desktop is probably not running;
  start it and run `pnpm start` again.
- `command not found` right after installing a tool → close the terminal
  and open a new one, so it picks the tool up.
- `Permission denied (publickey)` from GitHub → the SSH key isn't added
  to your GitHub account yet — step 2.
- Anything else: bring it to class. Setup trouble is normal and fixing it
  together is quick.

## If an update is announced

If an update is announced — new tasks, a fix, a better explanation — first save your own work into Git, then pull:

```sh
git add -A
git commit -m "my progress"
git pull
```

Git combines your implementations with changes automatically. If it
prints `CONFLICT` instead, the same lines have been edited — bring it to class
to resolve it together in a minute.
