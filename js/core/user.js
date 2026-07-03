export class User {
  constructor(username, password, role) {
    this.username = username;
    this.password = password;
    this.role = role;
  }
  verify(inputPassword) {
    console.log(`[Core] User verifying password...`);
    return this.password === inputPassword;
  }
  getRole() {
    return this.role;
  }
  isAdmin() {
    console.log(`[Core] User checking isAdmin`);
    return this.role === "admin";
  }
}
