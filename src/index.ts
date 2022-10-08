import {
  createConnection,
  TextDocuments,
  Diagnostic,
  DiagnosticSeverity,
  ProposedFeatures,
  InitializeParams,
  CompletionItem,
  CompletionItemKind,
  TextDocumentPositionParams,
  InitializeResult,
  TextDocumentChangeEvent,
  TextDocumentSyncKind,
  CodeAction,
} from "vscode-languageserver/node";
import { TextDocument } from "vscode-languageserver-textdocument";

import axios from "axios";
import * as fs from "fs";

import { Found } from "./found";

let connection = createConnection(ProposedFeatures.all);

let document: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

connection.onInitialize((_params: InitializeParams) => {
  const result: InitializeResult = {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      // Tell the client that this server supports code completion.
      completionProvider: {
        resolveProvider: true,
      },
      codeActionProvider: {
        resolveProvider: true,
      },
    },
  };

  return result;
});

connection.onInitialized(() => {});

connection.onDidChangeConfiguration((_change) => {});

connection.onDidChangeWatchedFiles((_change) => {});

connection.onCodeAction((param): CodeAction[] => {
  /*return [
        {
            title: "Add to dictionary",
            kind: "add",
            diagnostics: param.context.diagnostics,
            //data: param.range,
        },
    ];*/
  return [];
});

connection.onCodeActionResolve((action): CodeAction => {
  /*const server = "http://localhost:8081";
    const endpoint = "/v2/words/add";
    const language = "en-US";

    console.log("FROM RESOLVE")
    console.log(action)

    let diagnostics = action.diagnostics;
    if (diagnostics == undefined) {
        return action;
    }

    switch (action.data) {
        case "add":
            let url = server + endpoint + "?language=" + language + "&word=" + diagnostics[0].data;

            axios.post(url);
            break
    }*/

  return action;
});

document.onDidOpen((_change: TextDocumentChangeEvent<TextDocument>) => {});

document.onDidChangeContent(
  async (change: TextDocumentChangeEvent<TextDocument>) => {
    const text = change.document.getText();

    // TODO: create better regex to check strings and comments.
    // It works, but it's not perfect.

    // for // and /* */ comments.
    const regexComment = /(\/\/[^\n]*|\/\*.*\*\/)/g;
    // for "", '' or ``.
    const regexString = /(?<="|'|`)(.*?)(?="|'|`)/g;

    // combine all regexes.
    const regex = new RegExp(
      `${regexComment.source}|${regexString.source}`,
      "g"
    );

    let matched = text.match(regex);
    if (matched == null) {
      return;
    }

    let founds = matched?.map((value: any) => {
      const start = text.indexOf(value);
      const end = start + value.length;

      return new Found(start, end, value);
    });

    const server = "http://localhost:8081";
    const endpoint = "/v2/check";
    const language = "en-US";

    let diagnostics: Diagnostic[] = [];
    founds?.forEach(async (found: any) => {
      let url =
        server + endpoint + "?language=" + language + "&text=" + found.text;

      let response = await axios.get(url);

      let matches = response.data.matches;
      matches?.forEach((match: any) => {
        let diagnostic: Diagnostic = {
          severity: DiagnosticSeverity.Information,
          range: {
            start: change.document.positionAt(found.start + match.offset),
            end: change.document.positionAt(
              found.start + match.offset + match.length
            ),
          },
          message: match.message,
          source: match.rule.issueType,
          code: match.rule.id,
          data: match.context.text.slice(
            match.context.offset,
            match.context.length
          ),
        };

        diagnostics.push(diagnostic);
      });

      await connection.sendDiagnostics({
        uri: change.document.uri,
        diagnostics,
      });
    });
  }
);

document.onDidClose((_event) => {});

document.listen(connection);

connection.listen();
