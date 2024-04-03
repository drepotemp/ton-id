const { Telegraf } = require("telegraf");
require("dotenv").config();
const express = require("express");
const app = express();
const { Schema, model, default: mongoose } = require("mongoose");
const { v1: uuidv1 } = require("uuid");
const bodyParser = require("body-parser");
const cors = require("cors");
const bot = new Telegraf(process.env.BOT_TOKEN);
const chatIdToForwardAddresses = process.env.FORWARD_CHAT_ID;
let initialBalance = 100;
let aboutToTakeWalletAddress = false;

const BotUser = model(
  "BotUser",
  new Schema({
    chatId: String,
    userId: String,
    username: String,
    name: String,
    referralsCount: Number,
    balance: Number,
    walletAddress: String,
    referralLink: String,
    ipAddress: String,
  })
);

const checkIfUserAlreadyExists = async (userId) => {
  const userExists = await BotUser.findOne({ userId });
  if (userExists) {
    return true;
  }

  return false;
};

app.use(
  cors({
    origin: "*",
  })
);

// Parse URL-encoded bodies (deprecated in Express v4.16+)
app.use(bodyParser.urlencoded({ extended: false }));

// Parse JSON bodies
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Hello World");
});

//Endpoint for referral link
app.post("/referUser/:referralLink", async (req, res) => {
  const referralLink = req.params.referralLink;
  if (!referralLink) {
    res.status(404).json({
      success: true,
      message:
        "This link does not exist. Please ask its owner to send you a valid link.",
    });
  }

  const linkFirstChunk = "tonid.vercel.app/refer?inviteId=";
  const givenReferralLink = linkFirstChunk + referralLink;

  try {
    const linkOwner = await BotUser.findOne({
      referralLink: givenReferralLink,
    });

    if (linkOwner) {
      //Update balance
      const newBalance = linkOwner.balance + 25;
      linkOwner.balance = newBalance;

      //Update referral count
      const newReferralsCount = linkOwner.referralsCount + 1;
      linkOwner.referralsCount = newReferralsCount;

      //Save updates
      await linkOwner.save();
      res.status(200).json({
        success: true,
        data: { name: linkOwner.name, username: linkOwner.username },
      });
    } else {
      res.status(404).json({
        success: true,
        message:
          "This link does not exist. Please ask its owner to send you a valid link.",
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "An error occured. Please reload and try again.",
    });
  }
});

app.get("/admin-info", async (req, res) => {
  try {
    //Fetch all users
    const usersInDb = await BotUser.find();
    //Calculate total users
    const usersCount = usersInDb.length;
    //Calculate and store amounts earned
    let totalAmountEarnedByAllUsers = 0;
    usersInDb.forEach((eachUser) => {
      totalAmountEarnedByAllUsers += eachUser.balance;
    });

    res.status(200).json({
      success: true,
      data: {
        allUsers: usersInDb,
        numberOfUsers: usersCount,
        totalAmountEarnedByAllUsers,
      },
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Our service is down. Please try again later.",
    });
  }
});

const port = process.env.PORT || 7000;

mongoose
  .connect(process.env.URI)
  .then(() => {
    app.listen(port, () => {
      console.log(`App is listening on port ${port}`);
    });
    console.log("Connected to db.");
  })
  .catch((err) => {
    console.log(`Error connecting to db: ${err}`);
  });

const introMessage = `The core vision of TON IDENTITY token in the TON BLOCKCHAIN is to build the world's robust and largest identity powering financial network as a public utility giving ownership to each an every core believer of web3 and true decentralization.\n
Ton identity is targeting 100% of the entire people in crypto space and wishes to bring more than half of the total number of current crypto adopters to the ton blockchain through the world's largest inclusiveness and unprecedented airdrop distrubuting 55% of the total supply.\n\nComplete the tasks below:`;

const showUserDetails = async (userId, ctx) => {
  const userInfo = await BotUser.findOne({ userId });
  if (!userInfo) {
    return;
  }

  //Update full name and username if user changed them after using the bot initially
  const {
    name,
    username,
    walletAddress,
    referralLink,
    balance,
    referralsCount,
  } = userInfo;
  const currentName = `${ctx.from.first_name} ${ctx.from.lastName || ""}`;
  const currentUsername = ctx.from.username;

  if (name !== currentName || username !== currentUsername) {
    //Save updated details
    await BotUser.findOneAndUpdate(
      { userId },
      {
        name: currentName,
        username: currentUsername,
      }
    );
  }

  //Display user information
  const totalReferralEarnings = balance - initialBalance;
  const message = `Name: ${currentName}\n\nUsername: ${currentUsername}\n\nWallet Address: ${walletAddress}\n\nBalance: ${balance} TIT\n\nTotal Referrals: ${referralsCount}\n\nAmount earned from referrals: ${totalReferralEarnings} TIT\n\nKeep sharing your referral link with friends, to earn 25 TIT per referral.\n\nReferral Link:\n${referralLink}`;
  ctx.telegram.sendMessage(ctx.chat.id, message);
};

//Checked if user blocked the user
const botIsBlocked = async (chatId) => {
  try {
    const chatMember = await bot.telegram.getChatMember(chatId, bot.botInfo.id);
    return chatMember.status === "left" || chatMember.status === "kicked";
  } catch (error) {
    console.error("Error checking user status:", error);
    // Return true to handle the error gracefully, assuming the user is blocked
    return true;
  }
};

bot.start(async (ctx) => {
  //check if user already exists
  const userId = ctx.from.id;
  // let chatId = ctx.chat.id

  // Check if user already blocked the bot
  // if(botIsBlocked(chatId)){
  //   return ctx.reply('Sorry, it seems you have blocked the bot.');
  //   console.log(ctx.from.username)
  //  return
  // }

  let userExists = await checkIfUserAlreadyExists(userId);

  //Show account information if user already exists
  if (userExists) {
    await showUserDetails(userId, ctx);
    return;
  }

  takenAddress = false;
  ctx.telegram.sendMessage(ctx.chat.id, introMessage, {
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: "Task 1: Follow us on twitter 𝕏",
            url: "https://x.com/ton_identity?t=fxoLP4fgTBZF_SoyHB8loA&s=09",
          },
        ],
        [
          {
            text: "Task 2: Subscribe to our telegram channel ➤",
            url: "https://t.me/ton_idz",
          },
        ],
        [
          {
            text: "Click me when you're done.",
            callback_data: "take_wallet",
          },
        ],
      ],
    },
  });
});

bot.action("take_wallet", (ctx) => {
  //   if(ctx.message){
  // ctx.deleteMessage();
  //   }

  isDone = true;
  aboutToTakeWalletAddress = true;
  ctx.telegram.sendMessage(
    ctx.chat.id,
    "Great! Now send me your wallet address."
  );
});

bot.on("message", async (ctx) => {
  const userId = ctx.from.id;
  const userExists = await checkIfUserAlreadyExists(userId);
  //Show user account details if user already exists
  if (userExists && ctx.message.text.trim() == "/account_info") {
    return showUserDetails(userId, ctx);
  }

  if (!userExists && ctx.message.text.trim() == "/account_info") {
    return ctx.reply(
      "You have no account yet. Please start the bot and follow the instructions."
    );
  }

  if (!aboutToTakeWalletAddress) {
    return ctx.reply(
      "Invalid message/command. Please click the menu to view valid commands."
    );
  }

  if (ctx.message.text.trim()) {
    let walletAddress = ctx.message.text.trim();
    const isWalletValid = validateWalletAddress(walletAddress);

    if (!isWalletValid) {
      await ctx.reply("Invalid wallet address.");
      // Prompt user again for wallet address recursively
      await promptForWalletAddress(ctx);
    } else {
      aboutToTakeWalletAddress = false;
      //Create user account and store in db
      const newReferralLink = `tonid.vercel.app/refer?inviteId=${uuidv1()}`;
      const newUser = new BotUser({
        chatId: ctx.chat.id,
        userId: ctx.from.id,
        username: `@${ctx.from.username}`,
        name: `${ctx.from.first_name} ${ctx.from.last_name || ""}`,
        referralsCount: 0,
        balance: initialBalance,
        walletAddress,
        referralLink: newReferralLink,
        ipAddress: "",
      });

      await newUser.save();

      // If wallet is valid
      await ctx.reply(
        `Thanks!😊\nWe have received your wallet address!
        \nWait for Airdrop👍\n\nShare your referral link with friends, to earn 25 TIT per referral.\n\nReferral Link:\n${newReferralLink}`
      );
      // isDone = false;
      // takenAddress = true;

      // Send wallet address only to the specified group
      await bot.telegram.sendMessage(
        chatIdToForwardAddresses,
        `${walletAddress}`
      );
    }
  }
});

const promptForWalletAddress = async (ctx) => {
  await ctx.reply("Please enter a valid wallet address:");
};

const validateWalletAddress = (address) => {
  const MIN_LENGTH = 30; // Adjust based on your specific wallet address format

  if (
    !address ||
    typeof address !== "string" ||
    address.trim().length < MIN_LENGTH
  ) {
    return false;
  }

  return true;
};

bot.command("account_info", async (ctx) => {
  // Extract user ID from the message
  const userId = ctx.from.id;

  // Check if the user exists in the database
  const userExists = await checkIfUserAlreadyExists(userId);
  if (userExists) {
    // If the user exists, show their account information
    await showUserDetails(userId, ctx);
  } else {
    // If the user does not exist, prompt them to start the bot first
    await ctx.reply("Please start the bot first.");
  }
});

// Set bot commands for Telegram
bot.telegram.setMyCommands([
  { command: "start", description: "Start the TON ID Bot" },
  {
    command: "account_info",
    description: "Check your TON ID account information",
  },
]);

bot.launch();
