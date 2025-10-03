#!/usr/bin/env bash

dnf install -y tar gzip
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
. "$HOME/.cargo/env"

rustup update stable
rustup default stable
curl -L --proto '=https' --tlsv1.2 -sSf https://raw.githubusercontent.com/cargo-bins/cargo-binstall/main/install-from-binstall-release.sh | bash -s -- -y

cargo binstall -y dioxus-cli@0.7.0-rc.0 --force

