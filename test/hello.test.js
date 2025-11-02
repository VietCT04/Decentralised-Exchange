import { expect } from "chai";
import { ethers } from "hardhat";

describe("Hello", function () {
  it("returns pong", async function () {
    const Hello = await ethers.getContractFactory("Hello");
    const hello = await Hello.deploy();
    await hello.waitForDeployment();
    expect(await hello.ping()).to.equal("pong");
  });
});