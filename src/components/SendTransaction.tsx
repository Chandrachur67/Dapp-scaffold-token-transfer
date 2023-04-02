import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { FC, useCallback, useEffect, useState } from 'react';
import { WalletNotConnectedError } from '@solana/wallet-adapter-base';
import { notify } from "../utils/notifications";
import { Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction, TransactionSignature, clusterApiUrl, Connection, GetProgramAccountsFilter } from '@solana/web3.js';
import { } from "@solana/web3.js";
import { Metaplex, keypairIdentity, bundlrStorage, token } from "@metaplex-foundation/js";
import { createTransferInstruction, getOrCreateAssociatedTokenAccount, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { Metadata } from '@metaplex-foundation/mpl-token-metadata';
import 'reflect-metadata'

const solanaConnection = new Connection(clusterApiUrl('devnet'), 'confirmed');

const metaplex = Metaplex.make(solanaConnection);

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
        amount: 1,
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


                accounts.forEach(async account => {

                    const parsedAccountInfo: any = account.account.data;
                    const tokenAccountNo = account.pubkey.toString();
                    const mintAddress = parsedAccountInfo["parsed"]["info"]["mint"];
                    const tokenBalance = parsedAccountInfo["parsed"]["info"]["tokenAmount"]["uiAmount"];

                    // console.log("-----------------------------------")
                    // console.log(mintAddress)
                    // console.log(new PublicKey(mintAddress));

                    // const mintAddressPubKey = new PublicKey("EpfymMZdtoSJ3jPG3j85SdPSKPL1vMirrjqUEHvQTsjY");
                    try {
                        const mintpublicKey = new PublicKey(mintAddress);

                        const nft = await metaplex.nfts().findByMint({ mintAddress: mintpublicKey });
                        console.log(nft);

                        // console.log(nft.json.name);
                        console.log(nft.name);
                        let tokenAccount = {
                            tokenAccountNo: tokenAccountNo,
                            mintAddress: mintAddress,
                            tokenBalance: tokenBalance,
                            name: nft.name,
                            symbol: nft.symbol,
                            uri: nft.uri
                        }

                        setTokenAccounts(prevState => ([...prevState, tokenAccount]));
                    } catch (error) {
                        console.log(error)
                    }


                })

                console.log("-----------------------------------")

                console.log(tokenAccounts);
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

        else if (!formData.selectedTokenAccount) {
            notify({ type: 'error', message: `Select a Token!` });
            console.log('error', `Send Transaction: Select a Token!`);
            return;
        }

        else if (formData.amount > JSON.parse(formData.selectedTokenAccount).tokenBalance) {
            notify({ type: 'error', message: `Insufficient Token balance!` });
            console.log('error', `Send Transaction: Insufficient Token balance!`);
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
                    <input type="number" min="1" name="amount" value={formData.amount} onChange={handleChange} />
                </label>
                <label htmlFor="selectedTokenAccount">
                    Choose token
                    <select
                        name="selectedTokenAccount"
                        id="selectedTokenAccount"
                        value={formData.selectedTokenAccount}
                        onChange={handleChange}
                    >
                        <option value="">Select a token</option>
                        {tokenAccounts.map((tokenAccount, i) => {
                            return (
                                <option key={i + 1} value={JSON.stringify(tokenAccount)} >{tokenAccount.name}</option>
                            )
                        })}

                    </select>
                </label>
                {formData.selectedTokenAccount && <label htmlFor="balance">
                    Balance
                    <input type="text" value={JSON.parse(formData.selectedTokenAccount).tokenBalance} readOnly />
                </label>}
                <input type="submit" value="submit" id="submit" />
            </form>
        </div>
    );
};
