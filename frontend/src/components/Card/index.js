import React from "react"
import { CardHeader, Card as MuiCard, CardContent, makeStyles } from "@material-ui/core"
import css from "classnames"

import global from "styles/global"

const useStyles = makeStyles((theme) => ({
  card: {
    boxShadow: "none",
    padding: 0,
  },
  cardHeaderAction: {
    marginTop: 0,
    marginRight: 0,
    padding: 0,
  },
  cardHeaderContent: {
    paddingBottom: "5px",
  },
  cardContent: {
    paddingTop: 0,
  },
}))

function Card({ action, children, noHeader, subheader, title, bgColor, className }) {
  const g = global()
  const classes = useStyles()

  return (
    <MuiCard
      className={css(g.full_width, classes.card, className)}
      style={{ backgroundColor: bgColor }}
    >
      {!noHeader && (
        <CardHeader
          titleTypographyProps={{ variant: "h3" }}
          action={action}
          title={title}
          subheader={subheader}
          subheaderTypographyProps={{ className: g.cardSubheader }}
          classes={{
            action: classes.cardHeaderAction,
            content: classes.cardHeaderContent,
          }}
        />
      )}
      <CardContent className={classes.cardContent}>{children}</CardContent>
    </MuiCard>
  )
}

export default Card
