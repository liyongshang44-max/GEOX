declare global {
  interface Body {
    json(): Promise<any>;
  }

  interface Response {
    json(): Promise<any>;
  }
}

export {};
