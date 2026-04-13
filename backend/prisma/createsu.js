/*
 * Complete this script so that it is able to add a superuser to the database
 * Usage example: 
 *   node prisma/createsu.js clive123 clive.su@mail.utoronto.ca SuperUser123!
 */
'use strict';

const bcrypt = require("bcrypt");
const { PrismaClient } = require("@prisma/client");
const { isValidEmail, isValidPassword } = require("../src/utils/helpers");

const prisma = new PrismaClient();

function printUsage() {
    console.error(
        "Usage: node prisma/createsu.js <utorid> <email> <password>"
    );
}

async function main() {
    const [, , utorid, email, password] = process.argv;

    if (!utorid || !email || !password) {
        printUsage();
        process.exitCode = 1;
        return;
    }

    if (!isValidEmail(email)) {
        console.error("Invalid email format.");
        process.exitCode = 1;
        return;
    }

    if (!isValidPassword(password)) {
        console.error(
            "Invalid password format. Password must be 8-20 characters and include uppercase, lowercase, number, and symbol."
        );
        process.exitCode = 1;
        return;
    }

    const adminCount = await prisma.admin.count();
    if (adminCount > 0) {
        console.error("Administrator bootstrap already completed.");
        process.exitCode = 1;
        return;
    }

    const existingAccount = await prisma.account.findUnique({
        where: { email },
        select: { id: true },
    });
    if (existingAccount) {
        console.error("An account with that email already exists.");
        process.exitCode = 1;
        return;
    }

    const existingAdmin = await prisma.admin.findUnique({
        where: { utorid },
        select: { id: true },
    });
    if (existingAdmin) {
        console.error("An admin with that UTORid already exists.");
        process.exitCode = 1;
        return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const account = await prisma.$transaction(async (tx) => {
        const createdAccount = await tx.account.create({
            data: {
                email,
                password: hashedPassword,
                role: "admin",
                activated: true,
            },
            select: { id: true, email: true },
        });

        await tx.admin.create({
            data: {
                id: createdAccount.id,
                utorid,
            },
        });

        return createdAccount;
    });

    console.log(
        `Created superuser ${utorid} with account ${account.email} (id=${account.id}).`
    );
}

main()
    .catch((error) => {
        console.error("Failed to create superuser.");
        console.error(error.message);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
