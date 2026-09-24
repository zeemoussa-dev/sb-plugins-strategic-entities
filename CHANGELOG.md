# CHANGELOG

All notable changes to the Strategic Entities plugin.

## [Unreleased]

## [0.1.0] - 2026-09-24

- feat: the plugin's first shape. **Strategic Entities** in the side panel: the short list of companies that matter, searchable across customers, partners, affiliates and opportunities. Adding one writes it to `Settings/Strategic-Entities.md` and asks the install's Hermes job for an **Expert scoped to that company's folder and tags**; removing one asks for that Expert to be deleted. The company's own notes are never touched by either.
- feat: an entity's own screen -- the hub note, its **charts drawn** (SVG as text, anything else as a data URL, because a plugin screen cannot point an `<img>` at the backend), its people, its **captures, editable and saved exactly as given**, and the operator's **notes, saved as typed and then tidied by an agent with the original kept underneath**.
- test: 15, against a stubbed Plugin API and a real folder -- that a folder is not an entity (the note's `type` says so), that a Person note is not one either, that a file outside the folder cannot be asked for, that adding twice asks for one Expert, and that removing leaves the company's own files alone.
- docs: `REQ-SB-93` logged in the framework -- a plugin cannot create the Expert its feature is built on, nor find where agents live.
