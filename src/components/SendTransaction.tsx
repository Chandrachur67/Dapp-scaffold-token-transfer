import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { FC, useCallback, useEffect, useState } from 'react';
import { WalletNotConnectedError } from '@solana/wallet-adapter-base';
import { notify } from "../utils/notifications";
import { Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction, TransactionSignature } from '@solana/web3.js';
import { clusterApiUrl, Connection, GetProgramAccountsFilter } from "@solana/web3.js";
import { createTransferInstruction, getOrCreateAssociatedTokenAccount, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { Metadata } from '@metaplex-foundation/mpl-token-metadata';
import 'reflect-metadata'

const solanaConnection = new Connection(clusterApiUrl('devnet'), 'confirmed');

export const SendTransaction: FC = () => {

    // const onClick = useCallback(async () => {
    //     if (!publicKey) {
    //         notify({ type: 'error', message: `Wallet not connected!` });
    //         console.log('error', `Send Transaction: Wallet not connected!`);
    //         return;
    //     }

    //     // const pubKey = new PublicKey("7BzGMomgbswT6ynUmbkqA2mh2h9oGNgfKwfR2GrEmvRT");
    //     let signature: TransactionSignature = '';
    //     try {
    //         const destAddress = Keypair.generate().publicKey;
    //         // anything below this will fail, as this would be below the rent-exemption rate.
    //         const amount = 1_000_000;

    //         console.log(amount);

    //         const transaction = new Transaction().add(
    //             SystemProgram.transfer({
    //                 fromPubkey: publicKey,
    //                 toPubkey: destAddress,
    //                 lamports: amount,
    //             })
    //         );

    //         signature = await sendTransaction(transaction, connection);

    //         await connection.confirmTransaction(signature, 'confirmed');
    //         notify({ type: 'success', message: 'Transaction successful!', txid: signature });
    //     } catch (error: any) {
    //         notify({ type: 'error', message: `Transaction failed!`, description: error?.message, txid: signature });
    //         console.log('error', `Transaction failed! ${error?.message}`, signature);
    //         return;
    //     }
    // }, [publicKey, notify, connection, sendTransaction]);

    const { connection } = useConnection();
    const { publicKey, sendTransaction } = useWallet();

    const [tokenAccounts, setTokenAccounts] = useState([]);
    const [formData, setFormData] = useState({
        recipientAdress: "",
        amount: 0,
        selectedTokenAccount: ""
    })

    const handleChange = (event) => {
        setFormData(prevFormData => ({ ...prevFormData, [event.target.name]: event.target.value }))
    }
    useEffect(() => {

        if (publicKey) {

            const walletToQuery = publicKey.toBase58(); //example: vines1vzrYbzLMRdu58ou5XTby4qAqVRLmqo36NKPTg

            async function getTokenAccounts(wallet: string, solanaConnection: Connection) {
                const filters: GetProgramAccountsFilter[] = [
                    {
                        dataSize: 165,    //size of account (bytes)
                    },
                    {
                        memcmp: {
                            offset: 32,     //location of our query in the account (bytes)
                            bytes: wallet,  //our search criteria, a base58 encoded string
                        },
                    }];
                const accounts = await solanaConnection.getParsedProgramAccounts(
                    TOKEN_PROGRAM_ID, //new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA")
                    { filters: filters }
                );

                const allTokenAccounts = accounts.map(account => {
                    const parsedAccountInfo: any = account.account.data;
                    const tokenAccountNo = account.pubkey.toString();
                    const mintAddress = parsedAccountInfo["parsed"]["info"]["mint"];
                    const tokenBalance = parsedAccountInfo["parsed"]["info"]["tokenAmount"]["uiAmount"];

                    return {
                        tokenAccountNo: tokenAccountNo,
                        mintAddress: mintAddress,
                        tokenBalance: tokenBalance,
                    }

                })
                console.log(allTokenAccounts);
                setTokenAccounts(allTokenAccounts);
                console.log(`Found ${accounts.length} token account(s) for wallet ${wallet}.`);
                accounts.forEach((account, i) => {
                    //Parse the account data
                    const parsedAccountInfo: any = account.account.data;
                    const mintAddress: string = parsedAccountInfo["parsed"]["info"]["mint"];
                    const tokenBalance: number = parsedAccountInfo["parsed"]["info"]["tokenAmount"]["uiAmount"];
                    //Log results
                    console.log(`Token Account No. ${i + 1}: ${account.pubkey.toString()}`);
                    console.log(`--Token Mint: ${mintAddress}`);
                    console.log(`--Token Balance: ${tokenBalance}`);
                    // console.log(account.account.data);
                });
            }
            getTokenAccounts(walletToQuery, solanaConnection);
        }
    }, [publicKey])

    const handleTransaction = async (e) => {
        e.preventDefault();
        console.log(formData);

        if (!publicKey) {
            notify({ type: 'error', message: `Wallet not connected!` });
            console.log('error', `Send Transaction: Wallet not connected!`);
            return;
        }

        // const pubKey = new PublicKey("7BzGMomgbswT6ynUmbkqA2mh2h9oGNgfKwfR2GrEmvRT");
        let signature: TransactionSignature = '';
        try {
            const destAddress = new PublicKey(formData.recipientAdress);

            const fromWallet = Keypair.generate();

            let destinationAccount = await getOrCreateAssociatedTokenAccount(
                solanaConnection,
                fromWallet,
                new PublicKey(JSON.parse(formData.selectedTokenAccount).mintAddress),
                new PublicKey(destAddress)
            );
            // anything below this will fail, as this would be below the rent-exemption rate.
            const amount = formData.amount;

            console.log(amount);
            console.log(destinationAccount)

            const transaction = new Transaction().add(
                createTransferInstruction(
                    new PublicKey(JSON.parse(formData.selectedTokenAccount).tokenAccountNo),
                    destinationAccount.address,
                    publicKey,
                    amount * LAMPORTS_PER_SOL
                )
            );

            signature = await sendTransaction(transaction, connection);

            await connection.confirmTransaction(signature, 'confirmed');
            notify({ type: 'success', message: 'Transaction successful!', txid: signature });
        } catch (error: any) {
            console.log(error);
            notify({ type: 'error', message: `Transaction failed!`, description: error?.message, txid: signature });
            console.log('error', `Transaction failed! ${error?.message}`, signature);
            return;
        }
    }



    return (
        <div>
            {/* <button
                className="group w-60 m-2 btn animate-pulse disabled:animate-none bg-gradient-to-r from-[#9945FF] to-[#14F195] hover:from-pink-500 hover:to-yellow-500 ... "
                onClick={onClick} disabled={!publicKey}
            >
                <div className="hidden group-disabled:block ">
                    Wallet not connected
                </div>
                <span className="block group-disabled:hidden" >
                    Send Transaction
                </span>
            </button> */}
            <form action="" onSubmit={handleTransaction}>
                <label htmlFor="recipientAdress">
                    Enter recipient adress
                    <input type="text" name="recipientAdress" value={formData.recipientAdress} onChange={handleChange} />
                </label>
                <label htmlFor="amount">
                    Amount
                    <input type="text" name="amount" value={formData.amount} onChange={handleChange} />
                </label>
                <label htmlFor="selectedTokenAccount">
                    Choose the token you want to send
                    <select
                        name="selectedTokenAccount"
                        id="selectedTokenAccount"
                        value={formData.selectedTokenAccount}
                        onChange={handleChange}
                    >

                        {tokenAccounts.map((tokenAccount, i) => {
                            return (
                                <option key={i + 1} value={JSON.stringify(tokenAccount)} >{tokenAccount.tokenAccountNo}</option>
                            )
                        })}
                        {tokenAccounts.map((tokenAccount, i) => {
                            return (
                                <option key={i + 1} value={JSON.stringify(tokenAccount)} >{tokenAccount.tokenAccountNo}</option>
                            )
                        })}

                    </select>
                </label>
                {formData.selectedTokenAccount && <label htmlFor="balance">
                    Balance
                    <input type="text" value={JSON.parse(formData.selectedTokenAccount).tokenBalance} readOnly />
                </label>}
                <input type="submit" value="submit" />
            </form>
        </div>
    );
};
