import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  console.log(`Deploying AnonymousSurvey with account: ${deployer}`);

  const deployedAnonymousSurvey = await deploy("AnonymousSurvey", {
    from: deployer,
    log: true,
    waitConfirmations: 1,
  });

  console.log(`AnonymousSurvey contract deployed at: ${deployedAnonymousSurvey.address}`);
  console.log(`Transaction hash: ${deployedAnonymousSurvey.transactionHash}`);

  // Display usage instructions
  console.log("\n=== Anonymous Survey System Deployed ===");
  console.log("Users can now:");
  console.log("  1. Create surveys with encrypted voting");
  console.log("  2. Participate anonymously and earn rewards");
  console.log("  3. View aggregated results after survey ends");
  console.log("========================================\n");
};

export default func;
func.id = "deploy_anonymousSurvey";
func.tags = ["AnonymousSurvey"];


