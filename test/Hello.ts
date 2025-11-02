import { expect } from "chai";
import { ethers } from "hardhat";

describe("Hello", () => {
  it("returns pong", async () => {
    const Hello = await ethers.getContractFactory("Hello");
    const hello = await Hello.deploy();
    await hello.waitForDeployment();
    expect(await hello.ping()).to.equal("pong");
  });
});
