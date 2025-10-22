// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint32, euint8, ebool, externalEuint8} from "@fhevm/solidity/lib/FHE.sol";
import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title Anonymous Survey System with FHE
/// @author Anonymous Survey Team
/// @notice A privacy-preserving survey system where users can create surveys, vote anonymously, and view aggregated results
/// @dev Uses FHEVM for encrypted voting, with public decryption after survey ends
/// 
/// Economic Model:
/// - Survey Creator: Provides reward pool to incentivize participation
/// - Participants: Submit deposit when voting (prevents spam), get deposit back + reward after completion
contract AnonymousSurvey is SepoliaConfig {
    // ============ State Variables ============

    struct Survey {
        address creator;
        string question;
        string[] options; // Option descriptions (e.g., ["Apple", "Banana", "Orange"])
        uint256 endTime;
        uint256 rewardPool; // Total reward pool provided by creator
        uint256 depositRequired; // Deposit required from each participant (anti-spam)
        uint256 rewardPerResponse; // Reward for each valid response
        uint256 totalResponses;
        bool isActive;
        bool resultsReleased;
        mapping(uint256 => euint32) encryptedVotes; // optionIndex => encrypted vote count
        mapping(uint256 => uint32) decryptedVotes; // optionIndex => decrypted vote count (after release)
        mapping(address => bool) hasVoted; // Track if user has voted
        mapping(address => bool) hasWithdrawn; // Track if user has withdrawn their deposit+reward
    }

    // Survey ID counter
    uint256 public surveyCount;

    // Mapping from survey ID to Survey
    mapping(uint256 => Survey) public surveys;

    // Minimum and maximum options per survey
    uint256 public constant MIN_OPTIONS = 2;
    uint256 public constant MAX_OPTIONS = 10;

    // Minimum duration for a survey (1 minute for testing, 1 hour for production)
    uint256 public constant MIN_DURATION = 60; // 60 seconds for testing

    // Default deposit requirement (can be customized per survey)
    uint256 public constant DEFAULT_DEPOSIT = 0.001 ether;

    // ============ Events ============

    event SurveyCreated(
        uint256 indexed surveyId,
        address indexed creator,
        string question,
        uint256 optionCount,
        uint256 endTime,
        uint256 rewardPool,
        uint256 depositRequired,
        uint256 rewardPerResponse
    );

    event ResponseSubmitted(uint256 indexed surveyId, address indexed voter, uint256 timestamp, uint256 depositPaid);

    event ParticipantWithdrawal(
        uint256 indexed surveyId,
        address indexed participant,
        uint256 depositReturned,
        uint256 rewardPaid,
        uint256 totalPaid
    );

    event ResultsReleased(uint256 indexed surveyId, uint256 timestamp);

    event DecryptionRequested(uint256 indexed surveyId, uint256 indexed optionIndex, bytes32 voteHandle);

    event VoteDecrypted(uint256 indexed surveyId, uint256 optionIndex, uint32 voteCount);

    event RewardPoolWithdrawn(uint256 indexed surveyId, address indexed creator, uint256 amount);

    // ============ Errors ============

    error InvalidOptionCount();
    error InvalidDuration();
    error InsufficientRewardPool();
    error InsufficientDeposit();
    error SurveyNotFound();
    error SurveyEnded();
    error SurveyStillActive();
    error AlreadyVoted();
    error InvalidOptionIndex();
    error ResultsNotReleased();
    error NotCreator();
    error NotParticipant();
    error AlreadyWithdrawn();
    error RewardPoolEmpty();

    // ============ Core Functions ============

    /// @notice Create a new survey
    /// @param question The survey question
    /// @param options Array of option descriptions
    /// @param durationInSeconds How long the survey will be active
    /// @param depositRequired Deposit required from each participant (0 = use DEFAULT_DEPOSIT)
    /// @param rewardPerResponse Reward for each response (must be <= rewardPool / expected responses)
    /// @return surveyId The ID of the created survey
    function createSurvey(
        string memory question,
        string[] memory options,
        uint256 durationInSeconds,
        uint256 depositRequired,
        uint256 rewardPerResponse
    ) external payable returns (uint256 surveyId) {
        // Validate inputs
        if (options.length < MIN_OPTIONS || options.length > MAX_OPTIONS) {
            revert InvalidOptionCount();
        }
        if (durationInSeconds < MIN_DURATION) {
            revert InvalidDuration();
        }

        // Reward pool is the value sent by creator
        uint256 rewardPool = msg.value;
        if (rewardPool == 0) {
            revert InsufficientRewardPool();
        }

        // Use default deposit if not specified
        if (depositRequired == 0) {
            depositRequired = DEFAULT_DEPOSIT;
        }

        // Validate reward per response
        if (rewardPerResponse == 0 || rewardPerResponse > rewardPool) {
            revert InsufficientRewardPool();
        }

        // Create survey
        surveyId = surveyCount++;
        Survey storage survey = surveys[surveyId];

        survey.creator = msg.sender;
        survey.question = question;
        survey.options = options;
        survey.endTime = block.timestamp + durationInSeconds;
        survey.rewardPool = rewardPool;
        survey.depositRequired = depositRequired;
        survey.rewardPerResponse = rewardPerResponse;
        survey.totalResponses = 0;
        survey.isActive = true;
        survey.resultsReleased = false;

        // Initialize encrypted vote counts to 0 for each option
        for (uint256 i = 0; i < options.length; i++) {
            survey.encryptedVotes[i] = FHE.asEuint32(0);
            FHE.allowThis(survey.encryptedVotes[i]);
        }

        emit SurveyCreated(
            surveyId,
            msg.sender,
            question,
            options.length,
            survey.endTime,
            rewardPool,
            depositRequired,
            rewardPerResponse
        );
    }

    /// @notice Submit an encrypted vote to a survey (with deposit)
    /// @param surveyId The ID of the survey
    /// @param encryptedOptionIndex The encrypted option index (0-based)
    /// @param inputProof The proof for the encrypted input
    /// @dev Participant must send the required deposit with this transaction
    function submitResponse(
        uint256 surveyId,
        externalEuint8 encryptedOptionIndex,
        bytes calldata inputProof
    ) external payable {
        Survey storage survey = surveys[surveyId];

        // Validation
        if (survey.creator == address(0)) {
            revert SurveyNotFound();
        }
        if (block.timestamp >= survey.endTime) {
            revert SurveyEnded();
        }
        if (!survey.isActive) {
            revert SurveyEnded();
        }
        if (survey.hasVoted[msg.sender]) {
            revert AlreadyVoted();
        }

        // Check deposit
        if (msg.value < survey.depositRequired) {
            revert InsufficientDeposit();
        }

        // Convert external encrypted input to internal encrypted value
        euint8 encryptedOption = FHE.fromExternal(encryptedOptionIndex, inputProof);

        // Increment vote count for the selected option
        // We need to increment the vote for each possible option based on encrypted comparison
        uint256 optionCount = survey.options.length;

        for (uint256 i = 0; i < optionCount; i++) {
            // Check if encryptedOption == i
            ebool isThisOption = FHE.eq(encryptedOption, FHE.asEuint8(uint8(i)));

            // Add 1 if this is the selected option, otherwise add 0
            euint32 increment = FHE.select(isThisOption, FHE.asEuint32(1), FHE.asEuint32(0));

            survey.encryptedVotes[i] = FHE.add(survey.encryptedVotes[i], increment);
            FHE.allowThis(survey.encryptedVotes[i]);
        }

        // Mark user as voted
        survey.hasVoted[msg.sender] = true;
        survey.totalResponses++;

        emit ResponseSubmitted(surveyId, msg.sender, block.timestamp, msg.value);
    }

    /// @notice Participant withdraws their deposit + reward after voting
    /// @param surveyId The ID of the survey
    /// @dev Can be called anytime after voting (don't need to wait for survey to end)
    function withdrawParticipantFunds(uint256 surveyId) external {
        Survey storage survey = surveys[surveyId];

        // Validation
        if (survey.creator == address(0)) {
            revert SurveyNotFound();
        }
        if (!survey.hasVoted[msg.sender]) {
            revert NotParticipant();
        }
        if (survey.hasWithdrawn[msg.sender]) {
            revert AlreadyWithdrawn();
        }

        // Mark as withdrawn
        survey.hasWithdrawn[msg.sender] = true;

        // Calculate total payout: deposit + reward
        uint256 depositReturn = survey.depositRequired;
        uint256 reward = survey.rewardPerResponse;
        uint256 totalPayout = depositReturn + reward;

        // Check contract has enough balance
        require(address(this).balance >= totalPayout, "Insufficient contract balance");

        // Transfer funds
        (bool success, ) = payable(msg.sender).call{value: totalPayout}("");
        require(success, "Withdrawal failed");

        emit ParticipantWithdrawal(surveyId, msg.sender, depositReturn, reward, totalPayout);
    }

    /// @notice Release results and request decryption for a specific option
    /// @param surveyId The ID of the survey
    /// @param optionIndex The option index to decrypt
    /// @dev This function should be called for each option; frontend uses the emitted handle to call relayer.publicDecrypt()
    function releaseAndRequestDecrypt(uint256 surveyId, uint256 optionIndex) external {
        Survey storage survey = surveys[surveyId];

        // Validation
        if (survey.creator == address(0)) {
            revert SurveyNotFound();
        }
        if (block.timestamp < survey.endTime) {
            revert SurveyStillActive();
        }
        if (optionIndex >= survey.options.length) {
            revert InvalidOptionIndex();
        }

        // Mark results as released (first call)
        if (!survey.resultsReleased) {
            survey.resultsReleased = true;
            survey.isActive = false;
            emit ResultsReleased(surveyId, block.timestamp);
        }

        // Get the encrypted vote handle
        euint32 encryptedVote = survey.encryptedVotes[optionIndex];
        
        // Convert encrypted value to bytes32 handle for decryption request
        bytes32 voteHandle = FHE.toBytes32(encryptedVote);

        // Allow contract itself and caller to operate on this ciphertext
        FHE.allowThis(encryptedVote);
        FHE.allow(encryptedVote, msg.sender);

        // Emit event with handle for frontend to use with relayer.publicDecrypt()
        emit DecryptionRequested(surveyId, optionIndex, voteHandle);
    }

    /// @notice Callback function to store decrypted vote count
    /// @param surveyId The ID of the survey
    /// @param optionIndex The option index
    /// @param decryptedVote The decrypted vote count
    /// @dev This would typically be called by the Gateway/Oracle after decryption
    function storeDecryptedVote(uint256 surveyId, uint256 optionIndex, uint32 decryptedVote) external {
        Survey storage survey = surveys[surveyId];

        // In production, you'd verify this is called by the Gateway
        // For now, we allow anyone to call it (unsafe, for demo only)
        if (!survey.resultsReleased) {
            revert ResultsNotReleased();
        }
        if (optionIndex >= survey.options.length) {
            revert InvalidOptionIndex();
        }

        survey.decryptedVotes[optionIndex] = decryptedVote;

        emit VoteDecrypted(surveyId, optionIndex, decryptedVote);
    }

    /// @notice Creator withdraws unused reward pool after survey ends
    /// @param surveyId The ID of the survey
    /// @dev Creator can only withdraw rewards that were not distributed to participants
    function withdrawRewardPool(uint256 surveyId) external {
        Survey storage survey = surveys[surveyId];

        if (survey.creator == address(0)) {
            revert SurveyNotFound();
        }
        if (msg.sender != survey.creator) {
            revert NotCreator();
        }
        if (block.timestamp < survey.endTime) {
            revert SurveyStillActive();
        }
        if (survey.rewardPool == 0) {
            revert RewardPoolEmpty();
        }

        // Calculate remaining reward pool
        uint256 totalRewardsAllocated = survey.totalResponses * survey.rewardPerResponse;
        uint256 remaining = 0;

        if (survey.rewardPool > totalRewardsAllocated) {
            remaining = survey.rewardPool - totalRewardsAllocated;
        }

        // Mark reward pool as withdrawn
        survey.rewardPool = 0;

        // Transfer remaining reward pool to creator
        if (remaining > 0) {
            (bool success, ) = payable(survey.creator).call{value: remaining}("");
            require(success, "Withdrawal failed");
        }

        emit RewardPoolWithdrawn(surveyId, survey.creator, remaining);
    }

    // ============ View Functions ============

    /// @notice Get survey basic information
    /// @param surveyId The ID of the survey
    /// @return creator The survey creator
    /// @return question The survey question
    /// @return optionCount Number of options
    /// @return endTime When the survey ends
    /// @return totalResponses Total number of responses
    /// @return isActive Whether the survey is still active
    /// @return resultsReleased Whether results have been released
    function getSurveyInfo(uint256 surveyId)
        external
        view
        returns (
            address creator,
            string memory question,
            uint256 optionCount,
            uint256 endTime,
            uint256 totalResponses,
            bool isActive,
            bool resultsReleased
        )
    {
        Survey storage survey = surveys[surveyId];
        return (
            survey.creator,
            survey.question,
            survey.options.length,
            survey.endTime,
            survey.totalResponses,
            survey.isActive,
            survey.resultsReleased
        );
    }

    /// @notice Get all options for a survey
    /// @param surveyId The ID of the survey
    /// @return options Array of option descriptions
    function getSurveyOptions(uint256 surveyId) external view returns (string[] memory options) {
        return surveys[surveyId].options;
    }

    /// @notice Get encrypted vote count for an option (before decryption)
    /// @param surveyId The ID of the survey
    /// @param optionIndex The option index
    /// @return encryptedVote The encrypted vote count
    function getEncryptedVote(uint256 surveyId, uint256 optionIndex)
        external
        view
        returns (euint32 encryptedVote)
    {
        return surveys[surveyId].encryptedVotes[optionIndex];
    }

    /// @notice Get decrypted vote count for an option (after results released)
    /// @param surveyId The ID of the survey
    /// @param optionIndex The option index
    /// @return decryptedVote The decrypted vote count
    function getDecryptedVote(uint256 surveyId, uint256 optionIndex)
        external
        view
        returns (uint32 decryptedVote)
    {
        Survey storage survey = surveys[surveyId];
        if (!survey.resultsReleased) {
            revert ResultsNotReleased();
        }
        return survey.decryptedVotes[optionIndex];
    }

    /// @notice Get all decrypted votes for a survey (after results released)
    /// @param surveyId The ID of the survey
    /// @return votes Array of decrypted vote counts
    function getAllDecryptedVotes(uint256 surveyId) external view returns (uint32[] memory votes) {
        Survey storage survey = surveys[surveyId];
        if (!survey.resultsReleased) {
            revert ResultsNotReleased();
        }

        uint256 optionCount = survey.options.length;
        votes = new uint32[](optionCount);

        for (uint256 i = 0; i < optionCount; i++) {
            votes[i] = survey.decryptedVotes[i];
        }

        return votes;
    }

    /// @notice Check if a user has voted in a survey
    /// @param surveyId The ID of the survey
    /// @param user The user address
    /// @return hasVoted Whether the user has voted
    function hasUserVoted(uint256 surveyId, address user) external view returns (bool) {
        return surveys[surveyId].hasVoted[user];
    }

    /// @notice Check if a user has withdrawn their funds
    /// @param surveyId The ID of the survey
    /// @param user The user address
    /// @return hasWithdrawn Whether the user has withdrawn
    function hasUserWithdrawn(uint256 surveyId, address user) external view returns (bool) {
        return surveys[surveyId].hasWithdrawn[user];
    }

    /// @notice Get survey financial information
    /// @param surveyId The ID of the survey
    /// @return rewardPool Total reward pool
    /// @return depositRequired Deposit required per participant
    /// @return rewardPerResponse Reward per response
    /// @return totalRewardsAllocated Total rewards allocated
    /// @return remainingRewardPool Remaining reward pool
    /// @return totalDepositsHeld Total deposits held in contract
    function getSurveyFinancials(uint256 surveyId)
        external
        view
        returns (
            uint256 rewardPool,
            uint256 depositRequired,
            uint256 rewardPerResponse,
            uint256 totalRewardsAllocated,
            uint256 remainingRewardPool,
            uint256 totalDepositsHeld
        )
    {
        Survey storage survey = surveys[surveyId];
        totalRewardsAllocated = survey.totalResponses * survey.rewardPerResponse;
        remainingRewardPool = survey.rewardPool > totalRewardsAllocated 
            ? survey.rewardPool - totalRewardsAllocated 
            : 0;
        
        // Note: We can't efficiently iterate all voters, so this returns total potential deposits
        totalDepositsHeld = survey.totalResponses * survey.depositRequired;

        return (
            survey.rewardPool,
            survey.depositRequired,
            survey.rewardPerResponse,
            totalRewardsAllocated,
            remainingRewardPool,
            totalDepositsHeld
        );
    }

    /// @notice Get contract balance
    /// @return balance The contract's ETH balance
    function getContractBalance() external view returns (uint256) {
        return address(this).balance;
    }

    // ============ Helper Functions ============

    /// @notice Check if survey is still accepting responses
    /// @param surveyId The ID of the survey
    /// @return isOpen Whether the survey is open for responses
    function isSurveyOpen(uint256 surveyId) public view returns (bool) {
        Survey storage survey = surveys[surveyId];
        return survey.isActive && block.timestamp < survey.endTime;
    }

    /// @notice Calculate survey statistics (after results released)
    /// @param surveyId The ID of the survey
    /// @return percentages Array of percentages for each option (scaled by 100, e.g., 4567 = 45.67%)
    function getSurveyStatistics(uint256 surveyId) external view returns (uint256[] memory percentages) {
        Survey storage survey = surveys[surveyId];
        if (!survey.resultsReleased) {
            revert ResultsNotReleased();
        }

        uint256 optionCount = survey.options.length;
        percentages = new uint256[](optionCount);

        if (survey.totalResponses == 0) {
            return percentages; // All zeros
        }

        for (uint256 i = 0; i < optionCount; i++) {
            // Calculate percentage: (votes / totalResponses) * 10000 for 2 decimal precision
            percentages[i] = (uint256(survey.decryptedVotes[i]) * 10000) / survey.totalResponses;
        }

        return percentages;
    }

    /// @notice Get encrypted vote handle for HTTP public decryption
    /// @param surveyId The ID of the survey
    /// @param optionIndex The option index
    /// @return handle The bytes32 handle for the encrypted vote count
    /// @dev This function allows external callers to get the handle for use with instance.publicDecrypt()
    function getEncryptedVoteHandle(uint256 surveyId, uint256 optionIndex) external view returns (bytes32) {
        Survey storage survey = surveys[surveyId];
        
        // Validation
        if (survey.creator == address(0)) {
            revert SurveyNotFound();
        }
        if (optionIndex >= survey.options.length) {
            revert InvalidOptionIndex();
        }
        if (!survey.resultsReleased) {
            revert ResultsNotReleased();
        }

        // Get the encrypted vote and convert to bytes32 handle
        euint32 encryptedVote = survey.encryptedVotes[optionIndex];
        return FHE.toBytes32(encryptedVote);
    }

    // Allow contract to receive ETH
    receive() external payable {}
}
