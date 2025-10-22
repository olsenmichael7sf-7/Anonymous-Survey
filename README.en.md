# 🗳️ Anonymous Survey System

A fully privacy-preserving decentralized voting platform. Users can create surveys, participate anonymously, and view statistical results after voting ends. All votes remain completely encrypted and anonymous throughout the process.

> **Language Support**: Chinese/English bilingual support

## ✨ Why Choose This Platform?

### 🔒 True Anonymous Voting
- Your vote is encrypted from the moment of submission, impossible to trace
- During voting period, creators and others cannot see your choice
- Even blockchain explorers cannot view your selection
- Only statistical data is published after survey ends, individual votes never revealed

### 💰 Rewards for Participation
- **Creators**: Set up reward pools to attract more participants
- **Participants**: Earn rewards after completing votes
- **Deposit Mechanism**: Small deposit required for voting, fully refunded with rewards after survey ends
- **Anti-Spam Design**: Deposit mechanism effectively prevents malicious vote manipulation

### 🌐 Truly Decentralized
- No central servers, all data stored on blockchain
- No one can tamper with or delete survey results
- Voting results automatically published, creators cannot hide unfavorable results
- Completely transparent, yet completely anonymous

## 🎯 Use Cases

### Enterprise & Organizations
- 📊 **Employee Satisfaction Surveys** - Anonymously collect genuine feedback
- 🎨 **Product Research** - Understand users' real thoughts
- 🗳️ **Internal Decision Voting** - Fair and transparent team decisions
- 💡 **Creative Idea Selection** - Anonymous scoring, avoid favoritism

### Communities & DAOs
- 🏛️ **Governance Proposals** - Major community decisions
- 💎 **Fund Allocation Votes** - Transparent fund distribution
- 🎯 **Development Direction** - Collect genuine community opinions
- 📋 **Rule-Making Votes** - Democratize community management

### Academia & Research
- 📚 **Academic Surveys** - Protect respondent privacy
- 🔬 **Experimental Data Collection** - Anonymous opinion gathering
- 👥 **Peer Review Voting** - Fair academic evaluation
- 📊 **Behavioral Research** - Authentic data collection

### Daily Life
- 🎉 **Event Planning Votes** - Choose gathering time/location
- 🍕 **Team Dining Choice** - Anonymous restaurant selection
- 📺 **Movie Selection** - Democratically decide what to watch
- 🎮 **Interest Surveys** - Understand group preferences

## 🚀 Quick Start

### Prerequisites
1. Install [MetaMask](https://metamask.io/) browser wallet
2. Switch to Sepolia test network
3. Get some test ETH (free from [Sepolia Faucet](https://sepoliafaucet.com/))

### Getting Started

#### Option 1: Visit Online Version
Directly access the deployed website (if available)

#### Option 2: Run Locally
```bash
# 1. Clone the project
git clone <repository-url>
cd fhevm-hardhat-template

# 2. Install dependencies
npm install
cd frontend
npm install
cd ..

# 3. Start frontend
cd frontend
npm run dev
```

Visit `http://localhost:5173` to use the application

## 📖 User Guide

### 🎨 Create Survey (As Creator)

1. **Connect Wallet**
   - Click "Connect Wallet" button in top right
   - Confirm connection in MetaMask

2. **Fill Survey Information**
   - Navigate to "Create Survey" page
   - Enter survey question (e.g., "What's your favorite programming language?")
   - Add 2-10 options (e.g., "Python", "JavaScript", "Go", etc.)

3. **Configure Parameters**
   - **Survey Duration**: Choose voting period (1 hour to 30 days)
   - **Participation Deposit**: Set deposit voters need to pay (recommended 0.001-0.01 ETH)
   - **Total Reward Pool**: How much you're willing to reward participants (distributed evenly)

4. **Publish Survey**
   - Click "Create Survey"
   - Confirm transaction in MetaMask
   - Wait for transaction confirmation, survey successfully created

### ✅ Participate in Voting (As Voter)

1. **Browse Surveys**
   - View all active surveys on "Survey List" page
   - See for each survey:
     - Question content
     - Number of participants
     - Reward pool amount
     - Remaining time

2. **Select and Vote**
   - Click on survey of interest
   - Carefully read question and options
   - Choose your answer
   - Click "Submit Vote"

3. **Pay Deposit**
   - Confirm transaction in MetaMask
   - Pay required deposit (fully refunded with reward after survey ends)
   - Wait for transaction confirmation

4. **Claim Rewards**
   - After survey ends, return to the survey
   - Click "Claim Rewards" button
   - Receive full deposit refund + your reward share

### 📊 View Results

1. **Wait for Survey End**
   - During voting, all votes are encrypted, no one can see
   - After survey reaches end time, results automatically decrypt

2. **Trigger Result Publication**
   - Anyone can click "Release Results" button
   - This triggers blockchain to automatically decrypt voting data
   - After decryption, everyone can see statistical results

3. **Analyze Results**
   - View vote count for each option
   - View vote percentages
   - View visualization charts

## 💡 Best Practices

### When Creating Surveys
- ✅ Questions should be clear and unambiguous
- ✅ Options should be mutually exclusive, no overlap
- ✅ Rewards should be reasonable, attractive but sustainable
- ✅ Deposit shouldn't be too high, avoid discouraging participation
- ✅ Duration should be appropriate, not too short or too long

### When Participating
- ✅ Read question carefully, ensure understanding
- ✅ Check deposit amount and reward, evaluate participation
- ✅ Remember to return after survey ends to claim rewards
- ✅ Each address can only vote once, don't repeat

### Security Reminders
- ⚠️ This is a testnet project, don't use real funds
- ⚠️ Keep your wallet private key safe
- ⚠️ Confirm you're operating on Sepolia testnet
- ⚠️ Votes cannot be changed after submission, choose carefully

## 🌍 Language Switching

System supports Chinese and English:
- Click language toggle button in top right (🌐 中/En)
- Select your preferred language
- All interface text switches immediately
- Language preference saved in browser

## 🔍 How It Works

### Privacy Protection Technology
We use **FHEVM (Fully Homomorphic Encryption Virtual Machine)** technology:
- Your vote is encrypted in browser before submission
- Encrypted votes stored on blockchain
- Smart contract can count votes without decryption
- Only statistical results decrypted after survey ends
- Individual votes never decrypted or revealed

### Economic Incentive Model
```
Creator Input: Reward pool amount
Participant Input: Deposit (refundable)

After Survey Ends:
- Participants receive: Full deposit refund + (Reward Pool ÷ Participants)
- Creator receives: Data and insights
```

## ❓ FAQ

**Q: Is voting truly anonymous?**  
A: Yes! Using blockchain explorer only shows encrypted data, cannot see your specific choice.

**Q: What if creator doesn't publish results after survey ends?**  
A: Anyone can trigger result publication, not dependent on creator. Participants can claim rewards regardless.

**Q: Will deposit be refunded?**  
A: Yes! After survey ends, you can claim full deposit + your reward share.

**Q: Can I change my vote?**  
A: No. Once submitted, votes cannot be modified to ensure voting integrity.

**Q: How much does it cost?**  
A: On testnet, only need a little test ETH (free to obtain). Main costs are:
- Creating survey: Reward pool + Gas fees
- Participating: Deposit (refundable) + Gas fees

**Q: Why require deposit?**  
A: Deposit mechanism:
- Prevents bots and malicious vote manipulation
- Ensures participants are real users
- Incentivizes genuine participation
- Deposit is 100% refunded with rewards, no loss

**Q: What languages are supported?**  
A: Currently supports Chinese and English, can switch anytime.

## 🛠️ Tech Stack

For developers:
- Smart Contracts: Solidity + FHEVM
- Frontend: React + Vite
- Blockchain Interaction: Ethers.js
- Encryption Library: fhevmjs
- Network: Sepolia Testnet

See code comments for detailed technical documentation.

## 📜 License

This project is licensed under BSD-3-Clause-Clear.

## 🤝 Contributing

Welcome to submit issues and feature suggestions!

## ⚠️ Disclaimer

This is an experimental project for learning and testing purposes only. Do not use on mainnet or invest real funds. Smart contracts are not professionally audited, use at your own risk.

## 📞 Contact

Questions? Feel free to:
- Submit GitHub Issues
- Check code comments
- Read this documentation

---

**Protecting the privacy of every vote with blockchain technology 🗳️🔒**

> Returning voting to its essence: authentic, anonymous, fair

