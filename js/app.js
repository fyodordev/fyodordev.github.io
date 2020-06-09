App = {
  web3Provider: null,
  contracts: {},
  account: '0x0',
  account: null,
  accountBalance: 0,
  nextDrawingTime: 0,
  optionsCount: 0,
  defaultLottoLength: 60, // lottoLength in seconds
  selectedOption: 0,
  accountHasBet: false,
  renderInterval: undefined,
  winningOption: undefined,

  init: function () {
    return App.initWeb3();
  },

  initWeb3: function () {
    if (window.ethereum) {
      web3 = new Web3(window.ethereum);
      window.ethereum.enable();
    } else if (window.web3) {
      web3 = window.web3.currentProvider;
    }
    App.initContract();
  },

  betAllowed: () => {
    const currentTime = new Date().getTime();
    const deadline = new Date(App.nextDrawingTime * 1000).getTime()
    const timeLeft = deadline - currentTime;
    return timeLeft <= 0 || App.accountHasBet
  },

  stateChange: async () => {
    console.log('state change called')
    App.accountBalance = web3.utils.fromWei(await web3.eth.getBalance(App.account), "ether");
    App.nextDrawingTime = await App.lottoInstance.getNextDrawingTime(0);
    App.optionsCount = await App.lottoInstance.getNOptions(0);

    const getAccBets = (arr) => {
        return arr.filter((bet) => (
            typeof bet['user'] === 'string' &&
            typeof App.account === 'string' &&
            bet['user'].toLowerCase() === App.account.toLowerCase()
        ));
    };
    const allCurrentBets = await App.getBets()
    const allPreviousBets = await App.getPrevBets()
    const currentUserBets = getAccBets(allCurrentBets);
    const previousUserBets = getAccBets(allPreviousBets);
    const betAccumulator = (acc, currValue) => parseFloat(currValue.weight_eth) + acc;
    const sumUserBets = currentUserBets.reduce(betAccumulator, 0)
    const sumPreviousUserBets = previousUserBets.reduce(betAccumulator, 0)
    const sumAllUserBets = allCurrentBets.reduce(betAccumulator, 0)
    const sumAllPreviousUserBets = allPreviousBets.reduce(betAccumulator, 0)
    const [winningOptionIdx, winningOptionLabel] = await App.getWinningOption(1);
    const accountIsWinner = !previousUserBets.every(userBet => (
        parseInt(userBet['option_idx']) !== parseInt(winningOptionIdx)))
    console.log(`winning Option is: ${winningOptionIdx}`)
    console.log(`accountiswinner: ${accountIsWinner}`)
    console.log(`userInCurrentBets: ${JSON.stringify(currentUserBets)}`)
    console.log(`userInPreviousBets: ${JSON.stringify(previousUserBets)}`)
    console.log(`userInCurrentBets: ${sumUserBets}`)
    console.log(`userInPreviousBets: ${sumPreviousUserBets}`)
    if (sumUserBets > 0) {
        $("#placeBetText").val(sumUserBets * 1000);
    }
    App.accountHasBet = sumUserBets > 0
    $("#jackpot").html(`Jackpot: ${sumAllUserBets}`);
    $("#totalbets").html(`Total Bets: ${allCurrentBets.length}`);
    $("#resultLabel").html(accountIsWinner ?
        `You've won the previous round by choosing ${winningOptionLabel}` :
        `The winning option was ${winningOptionLabel}. Better luck next time!`
    );

    // Set interval
    const deadline = new Date(App.nextDrawingTime * 1000).getTime()
    const renderTime = () => {
        const currentTime = new Date().getTime();
        const timeLeft = deadline - currentTime;
            
        if (timeLeft > 0) {
            console.log('render time and time left')
            const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);
            $("#nextDrawingTime").html(`Bets close in ${minutes} minute${minutes === 1 ? 's' : ''}, ${seconds} seconds`);
                // code goes here
        } else {
            console.log('render time and time not left')
            console.log(`deadline is ${new Date(App.nextDrawingTime * 1000).toTimeString()}`)
            console.log(`now is ${new Date().toTimeString()}`)
            $("#nextDrawingTime").html(`Bets closed.`);
            App.render();
            clearInterval(App.renderInterval);
        }
    }
    if (!App.renderInterval) App.renderInterval = setInterval(renderTime, 1000)
    renderTime();

    App.render();
  },

  initContract: async () => {
    console.log('init called')
    let lottoJSON = await $.getJSON("Lotto.json");
    // Instantiate a new truffle contract from the artifact
    App.contracts.Lotto = TruffleContract(lottoJSON);
    // Connect provider to interact with contract
    App.contracts.Lotto.setProvider(web3.currentProvider);
    // get the deployed contract instance. `lottoInstance` is a truffle-contract object
    App.lottoInstance = await App.contracts.Lotto.at("0xA73f7A1e898BCe3FcA1Df2c32cA9581d4E96f159");
    App.account = window.ethereum.selectedAddress;


    // register callback which checks if the account has changed,
    // if so, rerender the affected parts of the application
    window.ethereum.on('accountsChanged', async function (accounts) {
        console.log('accounts changed')
        console.log(JSON.stringify(accounts));
      if (accounts[0] !== App.account) {
        App.account = accounts[0];
        await App.stateChange();
      }
    });

    $('#placeBetButton').on('click', async function(e) {
        e.preventDefault();
        const inputValue = $('#placeBetText').val()
        console.log(`place bet button clicked ${inputValue}`)
        if (!isNaN(inputValue)) {
            await App.placeBet(App.selectedOption, web3.utils.toWei((inputValue / 1000).toString()))
            App.accountHasBet = true
            App.render();
        }
    });


    web3.eth.subscribe('newBlockHeaders', async (err, res) => {
        console.log('blockchain update')
        await App.stateChange();
    });

    App.stateChange();
  },

  getOptionSelectHandler: (optionsIdx) => {
        return () => {
            console.log(`selected ${optionsIdx}`)
            App.selectedOption = optionsIdx
            App.render();
        };
  },

  render: () => {
    console.log('render is called')
    var loader = $("#loader");
    var content = $("#content");

    loader.show();
    content.hide();

    //App.renderDrawingTime();
    App.renderAccount();

    //web3.eth.getBalance(App.account, (err, balance) => {
    //    console.log(web3.utils.fromWei(balance, "ether") + " ETH")
    //});

    /*
    `<div class="list-group">
        <a href="#" class="list-group-item list-group-item-action active">
            Cras justo odio
        </a>
        <a href="#" class="list-group-item list-group-item-action">Dapibus ac facilisis in</a>
        <a href="#" class="list-group-item list-group-item-action">Morbi leo risus</a>
        <a href="#" class="list-group-item list-group-item-action">Porta ac consectetur ac</a>
        <a href="#" class="list-group-item list-group-item-action disabled">Vestibulum at eros</a>
    </div>`
    */
    const optionsList = App.getListOfOptions(App.nextDrawingTime, App.optionsCount);
    const optionsHtml = optionsList.map((option, idx) => `
        <button
            id="option${idx}"
            href="#"
            class="list-group-item list-group-item-action ${App.selectedOption === idx ? 'active' : ''}"
            onclick="App.getOptionSelectHandler(${idx})()"
            ${App.betAllowed() ? 'disabled' : ''}
        >
            ${option}
        </button>
    `);
    $("#optionsList").html(optionsHtml)
    $("#placeBetText").attr('disabled', App.betAllowed())
    $("#placeBetButton").attr('disabled', App.betAllowed())

    loader.hide();
    content.show();
  },

  renderAccount: () => {
    $("#accountAddress").html("Your Account: " + App.account);
    $("#accountBalance").html("Your Balance: " + App.accountBalance);
  },

  // helper to get a seemingly random but always deterministic list of
  // Options. Creates a rng using the given drawingTime and nOptions.
  // Whenever the arguments are identical, the result will be identical.
  getListOfOptions: (drawingTime, nOptions) => {
    rng = new RNG(drawingTime + nOptions);
    let presidentOptions = [];
    for (let i = 0; i < nOptions; i++) {
      var presidentI = rng.choice(presidents);
      presidentOptions.push(presidentI);
    }
    return presidentOptions;
  },

  placeBet: async (option, amount) => {
    let receipt = await App.lottoInstance.placeBet(option,
      {
        from: App.account,
        value: amount
      });
    return receipt;
  },

  // helper to convert a bet received from the contract into a more readable format
  solidityToJS_Bet: (bet, listOfOptions) => {
    let opt_idx = bet[2].toNumber();
    return {
      'user': bet[0],
      'weight_wei': bet[1].toString(),
      'weight_eth': web3.utils.fromWei(bet[1], 'ether').toString(),
      'option_idx': opt_idx,
      'option_president': listOfOptions[opt_idx],
    }
  },

  viewMyBet: async () => {
    let bet = await App.lottoInstance.viewMyBet({ from: App.account });
    let [nOptions, nextDrawingTime] = await Promise.all([
      App.lottoInstance.getNOptions(0),
      App.lottoInstance.getNextDrawingTime(0),
    ]);
    let listOfOptions = App.getListOfOptions(nextDrawingTime, nOptions);
    let betJS = App.solidityToJS_Bet(bet, listOfOptions);
    return betJS;
  },

  // helper method used by getBets and getPrevBets
  getBetsOf: async (getBetsFunc, listOfOptions) => {
    let { 0: addrs, 1: weights, 2: opt_idcs } = await getBetsFunc();
    // transpose snippet from: https://stackoverflow.com/a/36164530
    let transpose = m => m[0].map((x, i) => m.map(x => x[i]));
    let bets = transpose([addrs, weights, opt_idcs]);
    let betJSs = bets.map(x => App.solidityToJS_Bet(x, listOfOptions));

    return betJSs;
  },

  getBets: async () => {
    let [nOptions, nextDrawingTime] = await Promise.all([
      App.lottoInstance.getNOptions(0),
      App.lottoInstance.getNextDrawingTime(0),
    ]);
    let listOfOptions = App.getListOfOptions(nextDrawingTime, nOptions);
    return await App.getBetsOf(App.lottoInstance.getBets, listOfOptions);
  },

  getPrevBets: async () => {
    let [prevNOptions, prevDrawingTime] = await Promise.all([
      App.lottoInstance.getNOptions(1),
      App.lottoInstance.getNextDrawingTime(1),
    ]);
    let listOfOptions = App.getListOfOptions(prevDrawingTime, prevNOptions);
    return await App.getBetsOf(App.lottoInstance.getPrevBets, listOfOptions);
  },

  getJackpot: async () => {
    let jackpot = await web3.eth.getBalance(App.lottoInstance.contract._address);
    return web3.utils.fromWei(jackpot, 'ether');
  },

  getWinningOption: async (_idx) => {
    if (_idx <= 0) {
      throw new Error('Invalid argument: _idx must be > 1 because the current lottery has no winning option yet');
    }
    let idx = _idx !== undefined ? _idx : 1;
    let [winning_option, nOptions, drawingTime] = await Promise.all([
      App.lottoInstance.getWinningOption(idx),
      App.lottoInstance.getNOptions(idx),
      App.lottoInstance.getNextDrawingTime(idx),
    ]);
    let listOfOptions = App.getListOfOptions(drawingTime, nOptions);
    return [winning_option, listOfOptions[winning_option]];
  },

  getNBets: async () => {
    let numberOfPlacedBets = await App.lottoInstance.nBets();
    return numberOfPlacedBets;
  },

  // helper to get the value of the nextDrawingTime
  defineNextDrawingTime: (_lottoLength) => {
    let now = new Date();
    let nowValue = Math.round(now.valueOf() / 1000);
    let lottoLength = _lottoLength !== undefined ? _lottoLength : App.defaultLottoLength;
    let nextDrawingTime = nowValue + lottoLength;
    return nextDrawingTime
  },

  // lottoLength time in seconds
  eval_reset: async (_nOptions, _lottoLength) => {
    if (_nOptions === undefined) {
      _nOptions = await App.lottoInstance.getNOptions(0);
    }
    App.nextDrawingTime = App.defineNextDrawingTime(_lottoLength);
    let ret = await App.lottoInstance.eval_reset(_nOptions, App.nextDrawingTime, { from: App.account });
    App.render();
    return ret;
  },
};

// RNG code from https://stackoverflow.com/a/424445
function RNG(seed) {
  // LCG using GCC's constants
  this.m = 0x80000000; // 2**31;
  this.a = 1103515245;
  this.c = 12345;

  this.state = seed ? seed : Math.floor(Math.random() * (this.m - 1));
}
RNG.prototype.nextInt = function () {
  this.state = (this.a * this.state + this.c) % this.m;
  return this.state;
}
RNG.prototype.nextFloat = function () {
  // returns in range [0,1]
  return this.nextInt() / (this.m - 1);
}
RNG.prototype.nextRange = function (start, end) {
  // returns in range [start, end): including start, excluding end
  // can't modulu nextInt because of weak randomness in lower bits
  var rangeSize = end - start;
  var randomUnder1 = this.nextInt() / this.m;
  return start + Math.floor(randomUnder1 * rangeSize);
}
RNG.prototype.choice = function (array) {
  return array[this.nextRange(0,
    array.length)];
}

presidents = [
  "George Washington",
  "John Adams",
  "Thomas Jefferson",
  "James Madison",
  "James Monroe",
  "John Quincy Adams",
  "Andrew Jackson",
  "Martin Van Buren",
  "William Henry Harrison",
  "John Tyler",
  "James K. Polk",
  "Zachary Taylor",
  "Millard Fillmore",
  "Franklin Pierce",
  "James Buchanan",
  "Abraham Lincoln",
  "Andrew Johnson",
  "Ulysses S. Grant",
  "Rutherford B. Hayes",
  "James Garfield",
  "Chester Arthur",
  "Grover Cleveland",
  "Benjamin Harrison",
  "Grover Cleveland",
  "William McKinley",
  "Theodore Roosevelt",
  "William Howard Taft",
  "Woodrow Wilson",
  "Warren G. Harding",
  "Calvin Coolidge",
  "Herbert Hoover",
  "Franklin D. Roosevelt",
  "Harry S. Truman",
  "Dwight Eisenhower",
  "John F. Kennedy",
  "Gerald Ford",
  "Jimmy Carter",
  "Ronald Reagan",
  "George Bush",
  "Bill Clinton",
  "George W. Bush",
  "Barack Obama",
  "Donald Trump",
]

$(function () {
  $(window).load(function () {
    App.init();
  });
});
