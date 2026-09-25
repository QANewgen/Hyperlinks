import { test } from "@playwright/test";
import { createObjectCsvWriter } from "csv-writer";


test.setTimeout(3600000);



const CONFIG = {

    BLOG_URL:
    "https://www.dmifinance.in/news-media/blogs/page/",


    START_PAGE:18,

    END_PAGE:34,


    WAIT:1500,


    REPORT:
    "DMI_Blog_All_Hyperlinks_Report.csv"

};





function normalizeURL(url){

    try{

        const u =
        new URL(url);


        u.hash="";


        return u.href.replace(/\/$/,"");


    }
    catch{

        return url;

    }

}





function shouldIgnore(url){

    return (

        url.startsWith("mailto:")

        ||

        url.startsWith("tel:")

        ||

        url.includes("facebook.com")

        ||

        url.includes("instagram.com")

        ||

        url.includes("linkedin.com")

        ||

        url.includes("youtube.com")

        ||

        url.includes("twitter.com")

        ||

        url.includes("x.com")

    );

}





async function checkURL(request,url){


    try{


        const response =
        await request.get(

            url,

            {

                timeout:15000,

                ignoreHTTPSErrors:true

            }

        );


        return response.status();


    }
    catch(error){


        return "ERROR";

    }

}





async function safeGoto(page,url){


    try{


        await page.goto(

            url,

            {

                waitUntil:"domcontentloaded",

                timeout:60000

            }

        );


        await page.waitForTimeout(
            CONFIG.WAIT
        );


        return true;


    }

    catch(error){


        console.log(
            "Navigation failed:",
            url
        );


        return false;

    }


}







test(
"Validate All Blog Hyperlinks Page 18-34",

async({browser})=>{


const context =
await browser.newContext({

    ignoreHTTPSErrors:true,


    userAgent:
    "Mozilla/5.0 Chrome/120 Safari/537.36"

});



const page =
await context.newPage();



const request =
context.request;



let report=[];



let checkedURLs =
new Set();






for(
let pageNo=CONFIG.START_PAGE;
pageNo<=CONFIG.END_PAGE;
pageNo++
){



console.log(
`Checking Blog Listing Page ${pageNo}`
);



const listingURL =
`${CONFIG.BLOG_URL}${pageNo}/`;



const loaded =
await safeGoto(
    page,
    listingURL
);



if(!loaded){

    continue;

}






const articleURLs =

await page
.locator(
'a:has-text("Read Full Article")'
)
.evaluateAll(

links =>

links
.map(a=>a.href)
.filter(Boolean)

);





const uniqueArticles =
[...new Set(articleURLs)];



console.log(

`Articles found: ${uniqueArticles.length}`

);







for(
let articleIndex=0;
articleIndex<uniqueArticles.length;
articleIndex++
){



const articleURL =
uniqueArticles[articleIndex];



console.log(

`Opening Article ${articleIndex+1}`

);




const articleLoaded =
await safeGoto(

page,

articleURL

);



if(!articleLoaded){

    continue;

}






const title =
await page.title();





// Extract hyperlinks

const links =

await page.locator("a")
.evaluateAll(

anchors =>

anchors.map(a=>({

text:
a.innerText?.trim(),

href:
a.href

}))

);






for(
const link of links
){



let url =
normalizeURL(
link.href
);



if(

!url

||

shouldIgnore(url)

)

continue;




if(
checkedURLs.has(url)
)

continue;



checkedURLs.add(url);





const status =
await checkURL(

request,

url

);






report.push({

Blog_Page:
pageNo,


Article_Number:
articleIndex+1,


Article_Title:
title,


Blog_URL:
articleURL,


Link_Text:
link.text,


Hyperlink:
url,


HTTP_Status:
status,


Status:

(
status !== "ERROR"
&&
status < 400

)

?

"Working"

:

"Broken"


});





}



}



}







const csvWriter =

createObjectCsvWriter({

path:
CONFIG.REPORT,


header:[


{
id:"Blog_Page",
title:"Blog Page"
},


{
id:"Article_Number",
title:"Article Number"
},


{
id:"Article_Title",
title:"Article Title"
},


{
id:"Blog_URL",
title:"Blog URL"
},


{
id:"Link_Text",
title:"Link Text"
},


{
id:"Hyperlink",
title:"Hyperlink"
},


{
id:"HTTP_Status",
title:"HTTP Status"
},


{
id:"Status",
title:"Status"
}


]

});





await csvWriter.writeRecords(
report
);



console.log(
"================================"
);


console.log(
"Hyperlink Validation Completed"
);


console.log(
`Report: ${CONFIG.REPORT}`
);


console.log(
"================================"
);



await context.close();



});