import "dotenv/config";
import fs from "fs";
import nodemailer from "nodemailer";
import { URL, TARGET } from './constants.js';

const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;
const EMAIL_TO = process.env.EMAIL_TO;

async function fetchPage() {
    const controller = new AbortController();
    // 15 seconds timeout 
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
        const res = await fetch(URL, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
                "Accept": "text/html",
            },
            signal: controller.signal
        });
        if (!res.ok) throw new Error("Fetch failed: " + res.status);
        return await res.text();
    } finally {
        clearTimeout(timeout);
    }
}

function loadState() {
    if (!fs.existsSync("state.json")) return { notified: false };
    return JSON.parse(fs.readFileSync("state.json", "utf-8"));
}

function saveState(state) {
    fs.writeFileSync("state.json", JSON.stringify(state, null, 2));
}

async function sendEmail(subject, text) {
    const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
            user: EMAIL_USER,
            pass: EMAIL_PASS,
        },
    });

    await transporter.sendMail({
        from: `"HMT Watch Bot" <${EMAIL_USER}>`,
        to: EMAIL_TO,
        subject,
        text,
    });
}

async function main() {
    if (!EMAIL_USER || !EMAIL_PASS || !EMAIL_TO) {
        throw new Error("Missing EMAIL_USER / EMAIL_PASS / EMAIL_TO in .env file");
    }
    let html;
    try {
        html = await fetchPage();
    } catch (e) {
        console.error("Failed to fetch page:", e);
        throw e;
    }
    const found = html.includes(TARGET);

    const state = loadState();
    console.log("Found target?", found);

    if (found && !state.notified) {
        const msg = `"${TARGET}" is now visible on HMT site!\n\n${URL}`;
        try {
            await sendEmail("HMT Watch In Stock Alert", msg);
            state.notified = true;
            saveState(state);
            console.log("Email sent.");
        } catch (e) {
            console.error("Failed to send email:", e);
        }
    } else if (!found) {
        // reset so you get email again next time it reappears
        state.notified = false;
        saveState(state);
        console.log("Not found yet.");
    } else {
        console.log("Already notified earlier.");
    }
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});