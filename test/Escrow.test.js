const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("ConditionalEscrow", function () {
  
  async function deployEscrowFixture() {
    const [owner, buyer, seller, arbiter, attacker] = await ethers.getSigners();
    
    const Escrow = await ethers.getContractFactory("ConditionalEscrow");
    const escrow = await Escrow.deploy();
    
    const escrowAmount = ethers.parseEther("1.0"); // 1 ETH
    const description = "Kupovina laptopa";
    
    return { escrow, owner, buyer, seller, arbiter, attacker, escrowAmount, description };
  }
  
  // Helper: kreira i finansira escrow
  async function createAndFundEscrow(escrow, buyer, seller, arbiter, amount, description) {
    const tx = await escrow.connect(buyer).createEscrow(
      seller.address,
      arbiter.address,
      description
    );
    const receipt = await tx.wait();
    
    // Dobij escrowId iz eventa
    const event = receipt.logs.find(log => {
      try {
        return escrow.interface.parseLog(log).name === "EscrowCreated";
      } catch { return false; }
    });
    const parsed = escrow.interface.parseLog(event);
    const escrowId = parsed.args[0];
    
    // Finansiraj
    await escrow.connect(buyer).fundEscrow(escrowId, { value: amount });
    
    return escrowId;
  }
  
  
  describe("Deployment", function () {
    it("Treba da deploya ugovor uspesno", async function () {
      const { escrow } = await loadFixture(deployEscrowFixture);
      expect(await escrow.escrowCount()).to.equal(0);
    });
    
    it("Pocetni balans ugovora treba da bude 0", async function () {
      const { escrow } = await loadFixture(deployEscrowFixture);
      expect(await escrow.getContractBalance()).to.equal(0);
    });
  });
  
  describe("createEscrow", function () {
    it("Treba da kreira escrow sa ispravnim parametrima", async function () {
      const { escrow, buyer, seller, arbiter, description } = await loadFixture(deployEscrowFixture);
      
      await escrow.connect(buyer).createEscrow(seller.address, arbiter.address, description);
      
      const e = await escrow.getEscrow(0);
      expect(e.buyer).to.equal(buyer.address);
      expect(e.seller).to.equal(seller.address);
      expect(e.arbiter).to.equal(arbiter.address);
      expect(e.description).to.equal(description);
      expect(e.state).to.equal(0); // CREATED
    });
    
    it("Treba da emituje EscrowCreated event", async function () {
      const { escrow, buyer, seller, arbiter, description } = await loadFixture(deployEscrowFixture);
      
      await expect(
        escrow.connect(buyer).createEscrow(seller.address, arbiter.address, description)
      ).to.emit(escrow, "EscrowCreated")
        .withArgs(0, buyer.address, seller.address, arbiter.address, 0, await getTimestamp());
    });
    
    it("Treba da odbije kreiranje sa nultom adresom prodavca", async function () {
      const { escrow, buyer, arbiter, description } = await loadFixture(deployEscrowFixture);
      
      await expect(
        escrow.connect(buyer).createEscrow(ethers.ZeroAddress, arbiter.address, description)
      ).to.be.revertedWith("Escrow: Nevalidna adresa prodavca");
    });
    
    it("Treba da odbije kreiranje sa nultom adresom arbitara", async function () {
      const { escrow, buyer, seller, description } = await loadFixture(deployEscrowFixture);
      
      await expect(
        escrow.connect(buyer).createEscrow(seller.address, ethers.ZeroAddress, description)
      ).to.be.revertedWith("Escrow: Nevalidna adresa arbitara");
    });
    
    it("Treba da odbije kreiranje kada su kupac i prodavac ista adresa", async function () {
      const { escrow, buyer, arbiter, description } = await loadFixture(deployEscrowFixture);
      
      await expect(
        escrow.connect(buyer).createEscrow(buyer.address, arbiter.address, description)
      ).to.be.revertedWith("Escrow: Kupac i prodavac moraju biti razliciti");
    });
    
    it("Treba da odbije kreiranje kada je kupac arbitar", async function () {
      const { escrow, buyer, seller, description } = await loadFixture(deployEscrowFixture);
      
      await expect(
        escrow.connect(buyer).createEscrow(seller.address, buyer.address, description)
      ).to.be.revertedWith("Escrow: Kupac ne moze biti arbitar");
    });
    
    it("Treba da odbije kreiranje sa praznim opisom", async function () {
      const { escrow, buyer, seller, arbiter } = await loadFixture(deployEscrowFixture);
      
      await expect(
        escrow.connect(buyer).createEscrow(seller.address, arbiter.address, "")
      ).to.be.revertedWith("Escrow: Opis ne sme biti prazan");
    });
    
    it("Treba da incrementuje escrowCount", async function () {
      const { escrow, buyer, seller, arbiter, description } = await loadFixture(deployEscrowFixture);
      
      await escrow.connect(buyer).createEscrow(seller.address, arbiter.address, description);
      await escrow.connect(buyer).createEscrow(seller.address, arbiter.address, description);
      
      expect(await escrow.escrowCount()).to.equal(2);
    });
  });
  
  describe("fundEscrow", function () {
    it("Treba da finansira escrow ispravno", async function () {
      const { escrow, buyer, seller, arbiter, escrowAmount, description } = await loadFixture(deployEscrowFixture);
      
      await escrow.connect(buyer).createEscrow(seller.address, arbiter.address, description);
      await escrow.connect(buyer).fundEscrow(0, { value: escrowAmount });
      
      const e = await escrow.getEscrow(0);
      expect(e.amount).to.equal(escrowAmount);
      expect(e.state).to.equal(1); // FUNDED
    });
    
    it("Treba da emituje EscrowFunded event", async function () {
      const { escrow, buyer, seller, arbiter, escrowAmount, description } = await loadFixture(deployEscrowFixture);
      
      await escrow.connect(buyer).createEscrow(seller.address, arbiter.address, description);
      
      await expect(
        escrow.connect(buyer).fundEscrow(0, { value: escrowAmount })
      ).to.emit(escrow, "EscrowFunded")
        .withArgs(0, escrowAmount, await getTimestamp());
    });
    
    it("Treba da odbije finansiranje od strane ne-kupca", async function () {
      const { escrow, buyer, seller, arbiter, escrowAmount, description, attacker } = await loadFixture(deployEscrowFixture);
      
      await escrow.connect(buyer).createEscrow(seller.address, arbiter.address, description);
      
      await expect(
        escrow.connect(attacker).fundEscrow(0, { value: escrowAmount })
      ).to.be.revertedWith("Escrow: Samo kupac moze izvrsiti ovu akciju");
    });
    
    it("Treba da odbije finansiranje sa iznosom 0", async function () {
      const { escrow, buyer, seller, arbiter, description } = await loadFixture(deployEscrowFixture);
      
      await escrow.connect(buyer).createEscrow(seller.address, arbiter.address, description);
      
      await expect(
        escrow.connect(buyer).fundEscrow(0, { value: 0 })
      ).to.be.revertedWith("Escrow: Iznos mora biti veci od nule");
    });
    
    it("Treba da odbije dvostruko finansiranje", async function () {
      const { escrow, buyer, seller, arbiter, escrowAmount, description } = await loadFixture(deployEscrowFixture);
      
      await escrow.connect(buyer).createEscrow(seller.address, arbiter.address, description);
      await escrow.connect(buyer).fundEscrow(0, { value: escrowAmount });
      
      await expect(
        escrow.connect(buyer).fundEscrow(0, { value: escrowAmount })
      ).to.be.revertedWith("Escrow: Pogresno stanje za ovu akciju");
    });
  });
  
  describe("confirmDelivery", function () {
    it("Treba da oslobodi sredstva prodavcu", async function () {
      const { escrow, buyer, seller, arbiter, escrowAmount, description } = await loadFixture(deployEscrowFixture);
      
      const escrowId = await createAndFundEscrow(escrow, buyer, seller, arbiter, escrowAmount, description);
      
      const sellerBalanceBefore = await ethers.provider.getBalance(seller.address);
      
      await escrow.connect(buyer).confirmDelivery(escrowId);
      
      const sellerBalanceAfter = await ethers.provider.getBalance(seller.address);
      expect(sellerBalanceAfter - sellerBalanceBefore).to.equal(escrowAmount);
    });
    
    it("Treba da postavi state na COMPLETED", async function () {
      const { escrow, buyer, seller, arbiter, escrowAmount, description } = await loadFixture(deployEscrowFixture);
      
      const escrowId = await createAndFundEscrow(escrow, buyer, seller, arbiter, escrowAmount, description);
      await escrow.connect(buyer).confirmDelivery(escrowId);
      
      const e = await escrow.getEscrow(escrowId);
      expect(e.state).to.equal(3); // COMPLETED
      expect(e.amount).to.equal(0); // Zaštita od dvostrukog oslobađanja
    });
    
    it("Treba da emituje FundsReleased event", async function () {
      const { escrow, buyer, seller, arbiter, escrowAmount, description } = await loadFixture(deployEscrowFixture);
      
      const escrowId = await createAndFundEscrow(escrow, buyer, seller, arbiter, escrowAmount, description);
      
      await expect(
        escrow.connect(buyer).confirmDelivery(escrowId)
      ).to.emit(escrow, "FundsReleased")
        .withArgs(escrowId, seller.address, escrowAmount, await getTimestamp());
    });
    
    it("Treba da odbije potvrdu od strane ne-kupca", async function () {
      const { escrow, buyer, seller, arbiter, escrowAmount, description, attacker } = await loadFixture(deployEscrowFixture);
      
      const escrowId = await createAndFundEscrow(escrow, buyer, seller, arbiter, escrowAmount, description);
      
      await expect(
        escrow.connect(attacker).confirmDelivery(escrowId)
      ).to.be.revertedWith("Escrow: Samo kupac moze izvrsiti ovu akciju");
    });
    
    it("Treba da odbije potvrdu u pogresnom stanju", async function () {
      const { escrow, buyer, seller, arbiter, description } = await loadFixture(deployEscrowFixture);
      
      await escrow.connect(buyer).createEscrow(seller.address, arbiter.address, description);
      
      await expect(
        escrow.connect(buyer).confirmDelivery(0)
      ).to.be.revertedWith("Escrow: Pogresno stanje za ovu akciju");
    });
  });
  
  describe("raiseDispute", function () {
    it("Kupac treba da moze pokrenuti spor", async function () {
      const { escrow, buyer, seller, arbiter, escrowAmount, description } = await loadFixture(deployEscrowFixture);
      
      const escrowId = await createAndFundEscrow(escrow, buyer, seller, arbiter, escrowAmount, description);
      await escrow.connect(buyer).raiseDispute(escrowId);
      
      const e = await escrow.getEscrow(escrowId);
      expect(e.state).to.equal(2); // IN_DISPUTE
    });
    
    it("Prodavac treba da moze pokrenuti spor", async function () {
      const { escrow, buyer, seller, arbiter, escrowAmount, description } = await loadFixture(deployEscrowFixture);
      
      const escrowId = await createAndFundEscrow(escrow, buyer, seller, arbiter, escrowAmount, description);
      await escrow.connect(seller).raiseDispute(escrowId);
      
      const e = await escrow.getEscrow(escrowId);
      expect(e.state).to.equal(2); // IN_DISPUTE
    });
    
    it("Trecé lice ne treba da moze pokrenuti spor", async function () {
      const { escrow, buyer, seller, arbiter, escrowAmount, description, attacker } = await loadFixture(deployEscrowFixture);
      
      const escrowId = await createAndFundEscrow(escrow, buyer, seller, arbiter, escrowAmount, description);
      
      await expect(
        escrow.connect(attacker).raiseDispute(escrowId)
      ).to.be.revertedWith("Escrow: Samo kupac ili prodavac mogu pokrenuti spor");
    });
  });
  
  describe("resolveDispute", function () {
    it("Arbitar treba da moze dodeliti sredstva kupcu", async function () {
      const { escrow, buyer, seller, arbiter, escrowAmount, description } = await loadFixture(deployEscrowFixture);
      
      const escrowId = await createAndFundEscrow(escrow, buyer, seller, arbiter, escrowAmount, description);
      await escrow.connect(buyer).raiseDispute(escrowId);
      
      const buyerBalanceBefore = await ethers.provider.getBalance(buyer.address);
      await escrow.connect(arbiter).resolveDispute(escrowId, true); // kupac pobedi
      const buyerBalanceAfter = await ethers.provider.getBalance(buyer.address);
      
      expect(buyerBalanceAfter - buyerBalanceBefore).to.equal(escrowAmount);
    });
    
    it("Arbitar treba da moze dodeliti sredstva prodavcu", async function () {
      const { escrow, buyer, seller, arbiter, escrowAmount, description } = await loadFixture(deployEscrowFixture);
      
      const escrowId = await createAndFundEscrow(escrow, buyer, seller, arbiter, escrowAmount, description);
      await escrow.connect(buyer).raiseDispute(escrowId);
      
      const sellerBalanceBefore = await ethers.provider.getBalance(seller.address);
      await escrow.connect(arbiter).resolveDispute(escrowId, false); // prodavac pobedi
      const sellerBalanceAfter = await ethers.provider.getBalance(seller.address);
      
      expect(sellerBalanceAfter - sellerBalanceBefore).to.equal(escrowAmount);
    });
    
    it("Ne-arbitar ne treba da moze resiti spor", async function () {
      const { escrow, buyer, seller, arbiter, escrowAmount, description, attacker } = await loadFixture(deployEscrowFixture);
      
      const escrowId = await createAndFundEscrow(escrow, buyer, seller, arbiter, escrowAmount, description);
      await escrow.connect(buyer).raiseDispute(escrowId);
      
      await expect(
        escrow.connect(attacker).resolveDispute(escrowId, true)
      ).to.be.revertedWith("Escrow: Samo arbitar moze izvrsiti ovu akciju");
    });
    
    it("State treba da postane RESOLVED nakon arbitraze", async function () {
      const { escrow, buyer, seller, arbiter, escrowAmount, description } = await loadFixture(deployEscrowFixture);
      
      const escrowId = await createAndFundEscrow(escrow, buyer, seller, arbiter, escrowAmount, description);
      await escrow.connect(buyer).raiseDispute(escrowId);
      await escrow.connect(arbiter).resolveDispute(escrowId, true);
      
      const e = await escrow.getEscrow(escrowId);
      expect(e.state).to.equal(5); // RESOLVED
    });
  });
  
  describe("refundBuyer", function () {
    it("Prodavac treba da moze refundovati kupca", async function () {
      const { escrow, buyer, seller, arbiter, escrowAmount, description } = await loadFixture(deployEscrowFixture);
      
      const escrowId = await createAndFundEscrow(escrow, buyer, seller, arbiter, escrowAmount, description);
      
      const buyerBalanceBefore = await ethers.provider.getBalance(buyer.address);
      await escrow.connect(seller).refundBuyer(escrowId);
      const buyerBalanceAfter = await ethers.provider.getBalance(buyer.address);
      
      expect(buyerBalanceAfter - buyerBalanceBefore).to.equal(escrowAmount);
    });
    
    it("Kupac ne treba da moze refundovati sebe", async function () {
      const { escrow, buyer, seller, arbiter, escrowAmount, description } = await loadFixture(deployEscrowFixture);
      
      const escrowId = await createAndFundEscrow(escrow, buyer, seller, arbiter, escrowAmount, description);
      
      await expect(
        escrow.connect(buyer).refundBuyer(escrowId)
      ).to.be.revertedWith("Escrow: Samo prodavac moze izvrsiti ovu akciju");
    });
  });
  
  describe("Kontrola pristupa - granični slučajevi", function () {
    it("Treba da odbije akciju na nepostojecem escrow-u", async function () {
      const { escrow, buyer } = await loadFixture(deployEscrowFixture);
      
      await expect(
        escrow.getEscrow(999)
      ).to.be.revertedWith("Escrow: Nepostojeci escrow ID");
    });
    
    it("Arbitar ne sme zaobici proces (ne moze reci spor bez spor stanja)", async function () {
      const { escrow, buyer, seller, arbiter, escrowAmount, description } = await loadFixture(deployEscrowFixture);
      
      const escrowId = await createAndFundEscrow(escrow, buyer, seller, arbiter, escrowAmount, description);
      
      await expect(
        escrow.connect(arbiter).resolveDispute(escrowId, true)
      ).to.be.revertedWith("Escrow: Pogresno stanje za ovu akciju");
    });
  });
  
  async function getTimestamp() {
    const block = await ethers.provider.getBlock("latest");
    return block.timestamp + 1;
}
});